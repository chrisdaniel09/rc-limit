using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace RCLimit.Modules.System.Application.Theme;

public sealed record ValidatedTheme(JsonObject Document, IReadOnlyList<string> Warnings);

/// <summary>
/// Checks a tenant theme document when it is served (docs/ui_ux_specification.md §3.5–3.6). Themes are edited directly in
/// the database, so nothing validates them on save. Any value that fails is dropped, which leaves the platform default
/// in place for it; a document that doesn't parse becomes the platform default. The result is safe to send to the browser.
/// </summary>
public static partial class TenantThemeValidator
{
    // Tokens a tenant may override (§3.3 ✎), status colors included (§15-4).
    public static readonly string[] OverridableTokens =
    [
        "primary", "primary-foreground", "primary-subtle", "ring", "accent",
        "success", "success-subtle", "warning", "warning-subtle", "danger", "danger-subtle", "info", "info-subtle",
        "sidebar", "sidebar-foreground", "sidebar-active",
    ];

    private static readonly string[] StatusTokens = ["success", "warning", "danger", "info"];

    // Platform defaults (§3.3), used for contrast pairs a tenant doesn't override.
    private static readonly Dictionary<string, Dictionary<string, string>> Defaults = new()
    {
        ["light"] = new()
        {
            ["background"] = "oklch(0.985 0.002 250)", ["surface"] = "oklch(1 0 0)",
            ["primary"] = "oklch(0.51 0.23 277)", ["primary-foreground"] = "oklch(0.98 0.01 277)", ["primary-subtle"] = "oklch(0.96 0.03 277)",
            ["success"] = "oklch(0.55 0.15 150)", ["success-subtle"] = "oklch(0.96 0.04 150)",
            ["warning"] = "oklch(0.62 0.15 70)", ["warning-subtle"] = "oklch(0.97 0.05 85)",
            ["danger"] = "oklch(0.55 0.21 25)", ["danger-subtle"] = "oklch(0.96 0.03 25)",
            ["info"] = "oklch(0.55 0.13 240)", ["info-subtle"] = "oklch(0.96 0.025 240)",
            ["sidebar"] = "oklch(0.21 0.02 260)", ["sidebar-foreground"] = "oklch(0.80 0.01 255)",
        },
        ["dark"] = new()
        {
            ["background"] = "oklch(0.16 0.01 260)", ["surface"] = "oklch(0.20 0.012 260)",
            ["primary"] = "oklch(0.66 0.18 277)", ["primary-foreground"] = "oklch(0.16 0.03 277)", ["primary-subtle"] = "oklch(0.28 0.06 277)",
            ["success"] = "oklch(0.72 0.16 150)", ["success-subtle"] = "oklch(0.28 0.06 150)",
            ["warning"] = "oklch(0.80 0.15 80)", ["warning-subtle"] = "oklch(0.30 0.06 70)",
            ["danger"] = "oklch(0.68 0.19 25)", ["danger-subtle"] = "oklch(0.29 0.07 25)",
            ["info"] = "oklch(0.72 0.12 240)", ["info-subtle"] = "oklch(0.28 0.05 240)",
            ["sidebar"] = "oklch(0.13 0.01 260)", ["sidebar-foreground"] = "oklch(0.80 0.01 255)",
        },
    };

    private static readonly HashSet<string> AllowedFonts = ["Inter", "JetBrains Mono", "system-ui"];
    private static readonly HashSet<string> Densities = ["comfortable", "compact"];
    private static readonly HashSet<string> ColorModes = ["light", "dark", "system"];

    /// <param name="raw">The stored JSON, or null for none.</param>
    /// <param name="tenantId">Image URLs must sit under tenants/{tenantId}/ on the asset host.</param>
    /// <param name="organizationName">Brand name when the theme has none.</param>
    /// <param name="assetHost">The host branding images are served from (Cloudflare R2). Null allows any https host, with a warning.</param>
    public static ValidatedTheme Validate(string? raw, Guid tenantId, string organizationName, string? assetHost)
    {
        var warnings = new List<string>();
        var output = new JsonObject
        {
            ["version"] = 0,
            ["brand"] = new JsonObject { ["name"] = organizationName },
        };
        if (string.IsNullOrWhiteSpace(raw)) return new ValidatedTheme(output, warnings);

        JsonObject? doc;
        try
        {
            doc = JsonNode.Parse(raw) as JsonObject;
        }
        catch (JsonException ex)
        {
            warnings.Add($"Theme is not valid JSON ({ex.Message}); using the platform default.");
            return new ValidatedTheme(output, warnings);
        }
        if (doc is null)
        {
            warnings.Add("Theme is not a JSON object; using the platform default.");
            return new ValidatedTheme(output, warnings);
        }

        if (doc["version"] is JsonValue v && v.TryGetValue<int>(out var version)) output["version"] = version;

        output["brand"] = Brand(doc["brand"] as JsonObject, tenantId, organizationName, assetHost, warnings);

        if (doc["tokens"] is JsonObject tokens)
        {
            var light = ParseTokens(tokens["light"] as JsonObject, "light", warnings);
            var dark = ParseTokens(tokens["dark"] as JsonObject, "dark", warnings);
            DeriveDarkPrimary(light, dark);
            DeriveSubtle(light, "light");
            DeriveSubtle(dark, "dark");
            ApplyRules(light, "light", warnings);
            ApplyRules(dark, "dark", warnings);
            var outTokens = new JsonObject();
            if (light.Count > 0) outTokens["light"] = ToJson(light);
            if (dark.Count > 0) outTokens["dark"] = ToJson(dark);
            if (outTokens.Count > 0) output["tokens"] = outTokens;
        }

        if (doc["radius"] is JsonValue radius && radius.TryGetValue<string>(out var r))
        {
            if (RadiusPx(r) is { } px && px is >= 0 and <= 12) output["radius"] = r.Trim();
            else warnings.Add($"radius \"{r}\" must be 0–12px; dropped.");
        }

        if (doc["fonts"] is JsonObject fonts)
        {
            var outFonts = new JsonObject();
            foreach (var key in new[] { "ui", "data" })
            {
                var f = Str(fonts[key]);
                if (f is null) continue;
                if (AllowedFonts.Contains(f)) outFonts[key] = f;
                else warnings.Add($"fonts.{key} \"{f}\" is not on the allow-list; dropped.");
            }
            if (outFonts.Count > 0) output["fonts"] = outFonts;
        }

        if (doc["defaults"] is JsonObject defaults)
        {
            var outDefaults = new JsonObject();
            if (Str(defaults["density"]) is { } d && Densities.Contains(d)) outDefaults["density"] = d;
            if (Str(defaults["colorMode"]) is { } m && ColorModes.Contains(m)) outDefaults["colorMode"] = m;
            if (outDefaults.Count > 0) output["defaults"] = outDefaults;
        }

        if (doc["terminology"] is JsonObject terms)
        {
            var outTerms = new JsonObject();
            if (Str(terms["brokerLedgerName"]) is { Length: > 0 and <= 60 } name) outTerms["brokerLedgerName"] = name;
            if (Str(terms["brokerCounterpartyCode"]) is { } code && CodeRegex().IsMatch(code)) outTerms["brokerCounterpartyCode"] = code;
            if (outTerms.Count > 0) output["terminology"] = outTerms;
        }

        if (doc["supportContact"] is JsonObject contact)
        {
            var outContact = new JsonObject();
            if (Str(contact["email"]) is { } email && EmailRegex().IsMatch(email)) outContact["email"] = email;
            if (Str(contact["phone"]) is { } phone && PhoneRegex().IsMatch(phone)) outContact["phone"] = phone;
            if (outContact.Count > 0) output["supportContact"] = outContact;
        }

        foreach (var (key, _) in doc)
        {
            if (key is not ("version" or "brand" or "tokens" or "radius" or "fonts" or "defaults" or "terminology" or "supportContact"))
                warnings.Add($"Unknown theme key \"{key}\"; ignored.");
        }

        return new ValidatedTheme(output, warnings);
    }

    private static JsonObject Brand(JsonObject? brand, Guid tenantId, string organizationName, string? assetHost, List<string> warnings)
    {
        var name = Str(brand?["name"]);
        var result = new JsonObject { ["name"] = name is { Length: > 0 and <= 80 } ? name : organizationName };
        if (Str(brand?["shortName"]) is { Length: > 0 and <= 4 } shortName) result["shortName"] = shortName;
        if (brand is null) return result;

        string? Url(string path, JsonNode? node)
        {
            var url = Str(node);
            if (url is null) return null;
            if (IsAllowedImage(url, tenantId, assetHost, out var reason)) return url;
            warnings.Add($"brand.{path} dropped: {reason}");
            return null;
        }

        if (brand["logo"] is JsonObject logo)
        {
            var outLogo = new JsonObject();
            if (Url("logo.light", logo["light"]) is { } l) outLogo["light"] = l;
            if (Url("logo.dark", logo["dark"]) is { } d) outLogo["dark"] = d;
            if (outLogo.Count > 0) result["logo"] = outLogo;
        }
        if (Url("logoMark", brand["logoMark"]) is { } mark) result["logoMark"] = mark;
        if (Url("favicon", brand["favicon"]) is { } favicon) result["favicon"] = favicon;
        if (Url("loginBackground", brand["loginBackground"]) is { } bg) result["loginBackground"] = bg;
        if (assetHost is null && result.Any(p => p.Key is "logo" or "logoMark" or "favicon" or "loginBackground"))
            warnings.Add("Branding:AssetHost is not configured, so image hosts were not checked.");
        return result;
    }

    // §3.6: https only, on the asset host, under tenants/{tenantId}/; image types only.
    public static bool IsAllowedImage(string url, Guid tenantId, string? assetHost, out string reason)
    {
        reason = "";
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
        {
            reason = "not an https URL";
            return false;
        }
        if (assetHost is not null && !string.Equals(uri.Host, assetHost, StringComparison.OrdinalIgnoreCase))
        {
            reason = $"host {uri.Host} is not the asset host";
            return false;
        }
        if (assetHost is not null && !uri.AbsolutePath.StartsWith($"/tenants/{tenantId}/", StringComparison.OrdinalIgnoreCase))
        {
            reason = "path is outside this tenant's folder";
            return false;
        }
        var ext = Path.GetExtension(uri.AbsolutePath).ToLowerInvariant();
        if (ext is not (".svg" or ".png" or ".webp" or ".ico"))
        {
            reason = $"file type {ext} is not allowed";
            return false;
        }
        return true;
    }

    private static Dictionary<string, ThemeColor> ParseTokens(JsonObject? tokens, string mode, List<string> warnings)
    {
        var result = new Dictionary<string, ThemeColor>();
        if (tokens is null) return result;
        foreach (var (key, node) in tokens)
        {
            if (!OverridableTokens.Contains(key))
            {
                warnings.Add($"tokens.{mode}.{key} can't be overridden; dropped.");
                continue;
            }
            var value = Str(node);
            if (ThemeColor.TryParse(value, out var color)) result[key] = color;
            else warnings.Add($"tokens.{mode}.{key} \"{value}\" is not a color; dropped.");
        }
        return result;
    }

    // A tenant that supplies only a light primary gets a dark primary at lightness 0.66–0.72 that passes on the dark background.
    private static void DeriveDarkPrimary(Dictionary<string, ThemeColor> light, Dictionary<string, ThemeColor> dark)
    {
        if (!light.TryGetValue("primary", out var lp) || dark.ContainsKey("primary")) return;
        var bg = ThemeColor.Parse(Defaults["dark"]["background"]);
        var surface = ThemeColor.Parse(Defaults["dark"]["surface"]);
        var fg = ThemeColor.Parse(Defaults["dark"]["primary-foreground"]);
        for (var l = 0.66; l <= 0.7201; l += 0.01)
        {
            var candidate = lp.WithLightness(l, Math.Min(lp.C, 0.2));
            if (ThemeColor.Contrast(candidate, bg) >= 4.5 && ThemeColor.Contrast(candidate, surface) >= 4.5 && ThemeColor.Contrast(candidate, fg) >= 4.5)
            {
                dark["primary"] = candidate;
                return;
            }
        }
    }

    // primary-subtle follows primary when omitted (same hue, lightness 0.96 light / 0.28 dark, chroma ÷ 6).
    private static void DeriveSubtle(Dictionary<string, ThemeColor> tokens, string mode)
    {
        if (tokens.TryGetValue("primary", out var p) && !tokens.ContainsKey("primary-subtle"))
            tokens["primary-subtle"] = p.WithLightness(mode == "light" ? 0.96 : 0.28, p.C / 6);
    }

    private static void ApplyRules(Dictionary<string, ThemeColor> o, string mode, List<string> warnings)
    {
        var defaults = Defaults[mode];
        ThemeColor Eff(string key) => o.TryGetValue(key, out var c) ? c
            : key is "ring" or "accent" or "sidebar-active" ? Eff("primary")
            : ThemeColor.Parse(defaults[key]);
        var bg = Eff("background");
        var surface = Eff("surface");

        void Drop(string reason, params string[] keys)
        {
            var dropped = keys.Where(o.Remove).ToList();
            if (dropped.Count > 0) warnings.Add($"tokens.{mode}: {string.Join(", ", dropped)} dropped — {reason}");
        }

        // Repeat until stable: dropping one value can change another pair.
        for (var pass = 0; pass < 6; pass++)
        {
            var before = o.Count;
            if (ThemeColor.Contrast(Eff("primary-foreground"), Eff("primary")) < 4.5)
                Drop("primary-foreground on primary is below 4.5:1", "primary-foreground", "primary", "primary-subtle");
            if (ThemeColor.Contrast(Eff("primary"), bg) < 4.5 || ThemeColor.Contrast(Eff("primary"), surface) < 4.5)
                Drop("primary on background/surface is below 4.5:1", "primary", "primary-foreground", "primary-subtle");
            if (ThemeColor.Contrast(Eff("ring"), bg) < 3)
                Drop("ring on background is below 3:1", "ring");
            if (ThemeColor.Contrast(Eff("sidebar-foreground"), Eff("sidebar")) < 4.5)
                Drop("sidebar-foreground on sidebar is below 4.5:1", "sidebar-foreground", "sidebar");
            foreach (var status in new[] { "danger", "success" })
            {
                if (ThemeColor.HueDistance(Eff("primary"), Eff(status)) < 30)
                {
                    if (o.ContainsKey("primary")) Drop($"primary hue is within 30° of {status}", "primary", "primary-foreground", "primary-subtle");
                    else Drop($"{status} hue is within 30° of primary", status, $"{status}-subtle");
                }
            }
            foreach (var s in StatusTokens)
            {
                if (ThemeColor.Contrast(Eff(s), bg) < 3 || ThemeColor.Contrast(Eff(s), surface) < 3)
                    Drop($"{s} on background/surface is below 3:1", s, $"{s}-subtle");
                if ((o.ContainsKey(s) || o.ContainsKey($"{s}-subtle")) && ThemeColor.Contrast(Eff(s), Eff($"{s}-subtle")) < 4.5)
                    Drop($"{s} on {s}-subtle is below 4.5:1", s, $"{s}-subtle");
            }
            for (var i = 0; i < StatusTokens.Length; i++)
            {
                for (var j = i + 1; j < StatusTokens.Length; j++)
                {
                    string a = StatusTokens[i], b = StatusTokens[j];
                    if (ThemeColor.HueDistance(Eff(a), Eff(b)) >= 30) continue;
                    // Revert whichever the tenant changed; the defaults are far apart.
                    if (o.ContainsKey(b)) Drop($"{b} hue is within 30° of {a}", b, $"{b}-subtle");
                    else Drop($"{a} hue is within 30° of {b}", a, $"{a}-subtle");
                }
            }
            if (o.Count == before) break;
        }
    }

    private static JsonObject ToJson(Dictionary<string, ThemeColor> tokens)
    {
        var obj = new JsonObject();
        foreach (var key in OverridableTokens)
            if (tokens.TryGetValue(key, out var c)) obj[key] = c.ToCss();
        return obj;
    }

    private static double? RadiusPx(string value)
    {
        var m = RadiusRegex().Match(value.Trim());
        if (!m.Success) return null;
        var n = double.Parse(m.Groups[1].Value, global::System.Globalization.CultureInfo.InvariantCulture);
        return m.Groups[2].Value == "rem" ? n * 16 : n;
    }

    private static string? Str(JsonNode? node) =>
        node is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) ? s.Trim() : null;

    [GeneratedRegex(@"^(\d+(?:\.\d+)?)(px|rem)$")]
    private static partial Regex RadiusRegex();

    [GeneratedRegex(@"^[A-Z][A-Z0-9_]{0,39}$")]
    private static partial Regex CodeRegex();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^\+?[0-9 ]{7,20}$")]
    private static partial Regex PhoneRegex();
}

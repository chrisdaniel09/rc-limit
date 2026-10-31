using System.Text.Json.Nodes;
using RCLimit.Modules.System.Application.Theme;

namespace RCLimit.Modules.System.UnitTests;

public class TenantThemeValidatorTests
{
    private static readonly Guid Tenant = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    private const string AssetHost = "pub-test.r2.dev";

    private static ValidatedTheme Validate(string? json) => TenantThemeValidator.Validate(json, Tenant, "Anna Finance", AssetHost);

    private static string? Token(ValidatedTheme t, string mode, string key) => t.Document["tokens"]?[mode]?[key]?.GetValue<string>();

    [Fact]
    public void No_theme_gives_the_platform_default_with_the_organization_name()
    {
        var result = Validate(null);
        Assert.Equal("Anna Finance", result.Document["brand"]!["name"]!.GetValue<string>());
        Assert.Null(result.Document["tokens"]);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void Invalid_json_falls_back_to_the_platform_default_and_warns()
    {
        var result = Validate("{ not json");
        Assert.Null(result.Document["tokens"]);
        Assert.Single(result.Warnings);
    }

    [Fact]
    public void A_readable_brand_primary_is_kept_and_normalized_to_oklch()
    {
        var result = Validate("""{ "tokens": { "light": { "primary": "#1d4ed8", "primary-foreground": "#ffffff" } } }""");
        Assert.StartsWith("oklch(", Token(result, "light", "primary"));
        Assert.NotNull(Token(result, "light", "primary-foreground"));
    }

    [Fact]
    public void A_light_only_primary_gets_a_derived_dark_primary_and_subtle()
    {
        var result = Validate("""{ "tokens": { "light": { "primary": "#1d4ed8" } } }""");
        Assert.NotNull(Token(result, "dark", "primary"));
        Assert.NotNull(Token(result, "light", "primary-subtle"));
    }

    [Fact]
    public void A_pale_primary_that_fails_contrast_on_the_background_is_dropped()
    {
        var result = Validate("""{ "tokens": { "light": { "primary": "#c7d2fe" } } }""");
        Assert.Null(Token(result, "light", "primary"));
        Assert.Contains(result.Warnings, w => w.Contains("primary"));
    }

    [Fact]
    public void A_red_brand_too_close_to_danger_is_dropped()
    {
        var result = Validate("""{ "tokens": { "light": { "primary": "#b91c1c", "primary-foreground": "#ffffff" } } }""");
        Assert.Null(Token(result, "light", "primary"));
        Assert.Contains(result.Warnings, w => w.Contains("danger"));
    }

    [Fact]
    public void Status_colors_can_be_overridden_but_not_onto_another_status_hue()
    {
        // A warning recoloured to the danger hue would make amber and red indistinguishable.
        var result = Validate("""{ "tokens": { "light": { "warning": "oklch(0.55 0.2 30)", "warning-subtle": "oklch(0.97 0.03 30)" } } }""");
        Assert.Null(Token(result, "light", "warning"));
    }

    [Fact]
    public void Tokens_outside_the_overridable_list_and_css_injection_are_dropped()
    {
        var result = Validate("""{ "tokens": { "light": { "background": "#000000", "primary": "red; } body { display:none" } } }""");
        Assert.Null(Token(result, "light", "background"));
        Assert.Null(Token(result, "light", "primary"));
        Assert.Equal(2, result.Warnings.Count);
    }

    [Theory]
    [InlineData("https://pub-test.r2.dev/tenants/a1b2c3d4-e5f6-7890-abcd-ef1234567890/logo.3f9a.svg", true)]
    [InlineData("http://pub-test.r2.dev/tenants/a1b2c3d4-e5f6-7890-abcd-ef1234567890/logo.svg", false)]
    [InlineData("https://evil.example.com/tenants/a1b2c3d4-e5f6-7890-abcd-ef1234567890/logo.svg", false)]
    [InlineData("https://pub-test.r2.dev/tenants/00000000-0000-0000-0000-000000000000/logo.svg", false)]
    [InlineData("https://pub-test.r2.dev/tenants/a1b2c3d4-e5f6-7890-abcd-ef1234567890/logo.html", false)]
    public void Brand_images_must_be_https_on_the_asset_host_in_the_tenant_folder(string url, bool allowed)
    {
        Assert.Equal(allowed, TenantThemeValidator.IsAllowedImage(url, Tenant, AssetHost, out _));
    }

    [Fact]
    public void Brand_terminology_radius_and_fonts_are_checked()
    {
        var result = Validate("""
        {
          "version": 3,
          "brand": { "name": "Acme Finance", "shortName": "AC" },
          "radius": "0.5rem",
          "fonts": { "ui": "Comic Sans", "data": "JetBrains Mono" },
          "terminology": { "brokerLedgerName": "Acme balance", "brokerCounterpartyCode": "ACME" }
        }
        """);
        var doc = result.Document;
        Assert.Equal(3, doc["version"]!.GetValue<int>());
        Assert.Equal("Acme Finance", doc["brand"]!["name"]!.GetValue<string>());
        Assert.Equal("0.5rem", doc["radius"]!.GetValue<string>());
        Assert.Null(doc["fonts"]!["ui"]);
        Assert.Equal("JetBrains Mono", doc["fonts"]!["data"]!.GetValue<string>());
        Assert.Equal("Acme balance", doc["terminology"]!["brokerLedgerName"]!.GetValue<string>());
    }

    [Fact]
    public void Contrast_matches_wcag_for_black_on_white()
    {
        var ratio = ThemeColor.Contrast(ThemeColor.Parse("#000"), ThemeColor.Parse("#fff"));
        Assert.InRange(ratio, 20.9, 21.1);
    }

    [Theory]
    [InlineData("#4f46e5")]
    [InlineData("rgb(79, 70, 229)")]
    [InlineData("hsl(243 75% 59%)")]
    [InlineData("oklch(0.51 0.23 277)")]
    public void Every_accepted_color_syntax_parses_to_the_same_indigo(string input)
    {
        var c = ThemeColor.Parse(input);
        Assert.InRange(c.L, 0.48, 0.54);
        Assert.InRange(c.H, 265, 285);
    }

    [Fact]
    public void Default_theme_document_round_trips_as_json()
    {
        var json = Validate("""{ "brand": { "name": "X" } }""").Document.ToJsonString();
        Assert.IsType<JsonObject>(JsonNode.Parse(json));
    }
}

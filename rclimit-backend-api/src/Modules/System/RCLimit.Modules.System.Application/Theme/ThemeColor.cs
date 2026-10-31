using System.Globalization;
using System.Text.RegularExpressions;

namespace RCLimit.Modules.System.Application.Theme;

/// <summary>
/// A theme color parsed from hex, rgb(), hsl() or oklch(), with what the theme checks need:
/// WCAG relative luminance, OKLCH lightness/chroma/hue, and a normalized oklch() string (docs/ui_ux_specification.md §3.5–3.6).
/// </summary>
public sealed partial record ThemeColor(double L, double C, double H, double Luminance)
{
    public string ToCss() => string.Create(CultureInfo.InvariantCulture, $"oklch({L:0.###} {C:0.###} {H:0.#})");

    public ThemeColor WithLightness(double lightness, double? chroma = null) => FromOklch(lightness, chroma ?? C, H);

    public static double Contrast(ThemeColor a, ThemeColor b)
    {
        var (hi, lo) = a.Luminance >= b.Luminance ? (a.Luminance, b.Luminance) : (b.Luminance, a.Luminance);
        return (hi + 0.05) / (lo + 0.05);
    }

    /// <summary>Shortest distance between two hues in degrees. Near-grey colors have no meaningful hue, so they never clash.</summary>
    public static double HueDistance(ThemeColor a, ThemeColor b)
    {
        if (a.C < 0.03 || b.C < 0.03) return 180;
        var d = Math.Abs(a.H - b.H) % 360;
        return d > 180 ? 360 - d : d;
    }

    public static bool TryParse(string? input, out ThemeColor color)
    {
        color = null!;
        if (string.IsNullOrWhiteSpace(input)) return false;
        var s = input.Trim().ToLowerInvariant();
        try
        {
            if (s.StartsWith('#')) return TryHex(s[1..], out color);
            var m = FunctionRegex().Match(s);
            if (!m.Success) return false;
            var args = m.Groups["args"].Value.Split([' ', ',', '/'], StringSplitOptions.RemoveEmptyEntries);
            if (args.Length < 3) return false;
            switch (m.Groups["fn"].Value)
            {
                case "rgb" or "rgba":
                    color = FromSrgb(Channel(args[0]), Channel(args[1]), Channel(args[2]));
                    return true;
                case "hsl" or "hsla":
                {
                    var (r, g, b) = HslToRgb(Number(args[0].Replace("deg", "")), Percent(args[1]), Percent(args[2]));
                    color = FromSrgb(r, g, b);
                    return true;
                }
                case "oklch":
                {
                    var l = args[0].EndsWith('%') ? Number(args[0].TrimEnd('%')) / 100 : Number(args[0]);
                    var c = args[1].EndsWith('%') ? Number(args[1].TrimEnd('%')) / 100 * 0.4 : Number(args[1]);
                    var h = Number(args[2].Replace("deg", ""));
                    if (l is < 0 or > 1 || c is < 0 or > 0.5) return false;
                    color = FromOklch(l, c, h);
                    return true;
                }
                default:
                    return false;
            }
        }
        catch (FormatException)
        {
            return false;
        }
    }

    public static ThemeColor Parse(string input) =>
        TryParse(input, out var c) ? c : throw new FormatException($"Not a color: {input}");

    private static bool TryHex(string hex, out ThemeColor color)
    {
        color = null!;
        if (hex.Length is 3 or 4) hex = string.Concat(hex.Take(3).Select(ch => $"{ch}{ch}"));
        if (hex.Length is 8) hex = hex[..6];
        if (hex.Length != 6 || !hex.All(Uri.IsHexDigit)) return false;
        var r = int.Parse(hex[..2], NumberStyles.HexNumber) / 255.0;
        var g = int.Parse(hex[2..4], NumberStyles.HexNumber) / 255.0;
        var b = int.Parse(hex[4..6], NumberStyles.HexNumber) / 255.0;
        color = FromSrgb(r, g, b);
        return true;
    }

    private static double Number(string s) =>
        double.Parse(s, NumberStyles.Float, CultureInfo.InvariantCulture);

    private static double Percent(string s) => Number(s.TrimEnd('%')) / 100;

    private static double Channel(string s) => s.EndsWith('%') ? Percent(s) : Math.Clamp(Number(s), 0, 255) / 255.0;

    private static (double, double, double) HslToRgb(double h, double s, double l)
    {
        h = ((h % 360) + 360) % 360 / 360;
        double Hue(double p, double q, double t)
        {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1.0 / 6) return p + (q - p) * 6 * t;
            if (t < 0.5) return q;
            if (t < 2.0 / 3) return p + (q - p) * (2.0 / 3 - t) * 6;
            return p;
        }
        if (s == 0) return (l, l, l);
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        return (Hue(p, q, h + 1.0 / 3), Hue(p, q, h), Hue(p, q, h - 1.0 / 3));
    }

    private static double ToLinear(double c) => c <= 0.04045 ? c / 12.92 : Math.Pow((c + 0.055) / 1.055, 2.4);

    private static double RelativeLuminance(double lr, double lg, double lb) =>
        0.2126 * Math.Clamp(lr, 0, 1) + 0.7152 * Math.Clamp(lg, 0, 1) + 0.0722 * Math.Clamp(lb, 0, 1);

    private static ThemeColor FromSrgb(double r, double g, double b)
    {
        double lr = ToLinear(r), lg = ToLinear(g), lb = ToLinear(b);
        // Linear sRGB → OKLab (Björn Ottosson).
        var l = Math.Cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
        var m = Math.Cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
        var s = Math.Cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
        var okL = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
        var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
        var bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
        var c = Math.Sqrt(a * a + bb * bb);
        var h = (Math.Atan2(bb, a) * 180 / Math.PI + 360) % 360;
        return new ThemeColor(okL, c, h, RelativeLuminance(lr, lg, lb));
    }

    public static ThemeColor FromOklch(double l, double c, double h)
    {
        var hr = h * Math.PI / 180;
        var a = c * Math.Cos(hr);
        var b = c * Math.Sin(hr);
        var l_ = Math.Pow(l + 0.3963377774 * a + 0.2158037573 * b, 3);
        var m_ = Math.Pow(l - 0.1055613458 * a - 0.0638541728 * b, 3);
        var s_ = Math.Pow(l - 0.0894841775 * a - 1.2914855480 * b, 3);
        var lr = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
        var lg = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
        var lb = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;
        return new ThemeColor(l, c, (h % 360 + 360) % 360, RelativeLuminance(lr, lg, lb));
    }

    [GeneratedRegex(@"^(?<fn>rgba?|hsla?|oklch)\((?<args>[^)]*)\)$")]
    private static partial Regex FunctionRegex();
}

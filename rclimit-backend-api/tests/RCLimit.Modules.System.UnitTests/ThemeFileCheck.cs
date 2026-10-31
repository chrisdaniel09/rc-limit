using RCLimit.Modules.System.Application.Theme;
using Xunit.Abstractions;

namespace RCLimit.Modules.System.UnitTests;

/// <summary>
/// Checks a theme JSON file before it is written to system.tenant_settings.theme (docs/ui_ux_specification.md §3.6).
/// Does nothing unless THEME_FILE is set. Run:
///
///   $env:THEME_FILE = 'C:\path\theme.json'; $env:THEME_TENANT_ID = '&lt;tenant id&gt;'; $env:THEME_ASSET_HOST = 'pub-xxxx.r2.dev'
///   dotnet test tests/RCLimit.Modules.System.UnitTests --filter ThemeFileCheck --logger "console;verbosity=detailed"
///
/// Prints every dropped value with the failing pair, then the document the API would serve. Fails if anything was dropped.
/// </summary>
public class ThemeFileCheck(ITestOutputHelper output)
{
    [Fact]
    public void Theme_file_passes_every_check()
    {
        var path = Environment.GetEnvironmentVariable("THEME_FILE");
        if (string.IsNullOrWhiteSpace(path)) return;

        var tenantId = Guid.TryParse(Environment.GetEnvironmentVariable("THEME_TENANT_ID"), out var id) ? id : Guid.Empty;
        var assetHost = Environment.GetEnvironmentVariable("THEME_ASSET_HOST");
        var result = TenantThemeValidator.Validate(File.ReadAllText(path), tenantId, "(organization name)", string.IsNullOrWhiteSpace(assetHost) ? null : assetHost);

        output.WriteLine(result.Warnings.Count == 0 ? "PASS: every value passed." : $"FAIL: {result.Warnings.Count} problem(s):");
        foreach (var warning in result.Warnings) output.WriteLine($"  - {warning}");
        output.WriteLine("");
        output.WriteLine("Served document:");
        output.WriteLine(result.Document.ToJsonString(new global::System.Text.Json.JsonSerializerOptions { WriteIndented = true }));

        Assert.Empty(result.Warnings);
    }
}

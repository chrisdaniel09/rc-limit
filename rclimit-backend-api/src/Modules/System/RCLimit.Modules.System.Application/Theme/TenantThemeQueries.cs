using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RCLimit.Modules.System.Application.Abstractions;

namespace RCLimit.Modules.System.Application.Theme;

public class BrandingOptions
{
    public const string SectionName = "Branding";

    /// <summary>
    /// Host that serves branding images (Cloudflare R2). For now the bucket's public r2.dev URL, for example
    /// pub-1234abcd.r2.dev; a custom domain later (docs/ui_ux_specification.md §3.5).
    /// </summary>
    public string? AssetHost { get; set; }
}

/// <summary>The tenant theme for the browser, validated (§3.6). Anonymous: the tenant comes from the request host.</summary>
public record GetTenantThemeQuery(Guid TenantId) : IRequest<JsonObject>;

public class GetTenantThemeQueryHandler(
    ISystemDbContext db,
    IMemoryCache cache,
    IOptions<BrandingOptions> options,
    ILogger<GetTenantThemeQueryHandler> logger) : IRequestHandler<GetTenantThemeQuery, JsonObject>
{
    public async Task<JsonObject> Handle(GetTenantThemeQuery request, CancellationToken cancellationToken)
    {
        var row = await db.TenantSettings
            .AsNoTracking()
            .Where(s => s.TenantId == request.TenantId)
            .Select(s => new { s.Theme, s.Tenant.OrganizationName })
            .FirstOrDefaultAsync(cancellationToken);

        var raw = row?.Theme;
        var organizationName = row?.OrganizationName ?? "RC Limit";

        // Validation is cached per stored document, so a database edit takes effect on the next request.
        var cacheKey = $"tenant:theme:{request.TenantId}:{Hash(raw)}:{organizationName}";
        if (cache.TryGetValue(cacheKey, out JsonObject? cached) && cached is not null)
            return (JsonObject)cached.DeepClone();

        var result = TenantThemeValidator.Validate(raw, request.TenantId, organizationName, options.Value.AssetHost);
        foreach (var warning in result.Warnings)
            logger.LogWarning("Tenant {TenantId} theme: {Warning}", request.TenantId, warning);

        cache.Set(cacheKey, result.Document, TimeSpan.FromMinutes(10));
        return (JsonObject)result.Document.DeepClone();
    }

    private static string Hash(string? value) =>
        value is null ? "none" : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)))[..16];
}

public record TenantUiSettingsDto(int SubLimitWarnPct, int SubLimitDangerPct);

/// <summary>Tenant settings the signed-in UI needs (§6.4 utilization thresholds).</summary>
public record GetTenantUiSettingsQuery(Guid TenantId) : IRequest<TenantUiSettingsDto>;

public class GetTenantUiSettingsQueryHandler(ISystemDbContext db) : IRequestHandler<GetTenantUiSettingsQuery, TenantUiSettingsDto>
{
    public const int DefaultWarnPct = 70;
    public const int DefaultDangerPct = 90;

    public async Task<TenantUiSettingsDto> Handle(GetTenantUiSettingsQuery request, CancellationToken cancellationToken)
    {
        var row = await db.TenantSettings
            .AsNoTracking()
            .Where(s => s.TenantId == request.TenantId)
            .Select(s => new { s.SubLimitWarnPct, s.SubLimitDangerPct })
            .FirstOrDefaultAsync(cancellationToken);

        var warn = row?.SubLimitWarnPct ?? DefaultWarnPct;
        var danger = row?.SubLimitDangerPct ?? DefaultDangerPct;
        // The database constraints keep warn < danger when both are set; one set alone can still cross the other default.
        if (warn >= danger) (warn, danger) = (DefaultWarnPct, DefaultDangerPct);
        return new TenantUiSettingsDto(warn, danger);
    }
}

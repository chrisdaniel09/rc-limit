using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.Modules.System.Infrastructure.Persistence;

namespace RCLimit.Modules.System.Infrastructure;

/// <summary>
/// Resolves a tenant's session lifetimes: tenant setting if present, otherwise the platform default,
/// always clamped to the allowed range (spec section 5). Cached for five minutes per tenant.
/// </summary>
public sealed class TenantSessionPolicyProvider(
    IServiceScopeFactory scopeFactory,
    IMemoryCache cache,
    IOptions<AuthOptions> options) : ITenantSessionPolicyProvider
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public async Task<TenantSessionPolicy> GetAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var cacheKey = CacheKey(tenantId);
        if (cache.TryGetValue(cacheKey, out TenantSessionPolicy? cached) && cached is not null)
            return cached;

        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SystemDbContext>();

        var settings = await db.TenantSettings
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId)
            .Select(s => new { s.AccessTokenMinutes, s.IdleTimeoutDays, s.AbsoluteTimeoutDays, s.MaxSessionsPerUser })
            .FirstOrDefaultAsync(cancellationToken);

        var defaults = options.Value.Session;
        var idle = Clamp(settings?.IdleTimeoutDays ?? defaults.IdleTimeoutDays, 1, 30);
        var absolute = Clamp(settings?.AbsoluteTimeoutDays ?? defaults.AbsoluteTimeoutDays, 1, 90);

        var policy = new TenantSessionPolicy(
            AccessTokenMinutes: Clamp(settings?.AccessTokenMinutes ?? defaults.AccessTokenMinutes, 5, 60),
            IdleTimeoutDays: idle,
            AbsoluteTimeoutDays: Math.Max(absolute, idle),
            MaxSessionsPerUser: settings?.MaxSessionsPerUser is { } max ? Clamp(max, 1, 50) : null);

        cache.Set(cacheKey, policy, CacheDuration);
        return policy;
    }

    public void Invalidate(Guid tenantId) => cache.Remove(CacheKey(tenantId));

    private static string CacheKey(Guid tenantId) => $"tenant:session-policy:{tenantId}";

    private static int Clamp(int value, int min, int max) => Math.Min(Math.Max(value, min), max);
}

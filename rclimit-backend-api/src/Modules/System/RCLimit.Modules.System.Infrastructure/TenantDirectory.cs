using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.System.Infrastructure.Persistence;

namespace RCLimit.Modules.System.Infrastructure;

/// <summary>
/// Resolves tenants by domain (custom_domain or subdomain-based slug).
/// Implements domain-based multi-tenancy for request routing.
/// </summary>
public class TenantDirectory(
    SystemDbContext dbContext,
    IMemoryCache cache,
    TenantResolutionOptions options) : ITenantDirectory
{
    private const string CacheKeyPrefix = "tenant:host:";
    private readonly TimeSpan _cacheDuration = TimeSpan.FromMinutes(5);

    public async Task<TenantInfo?> FindByHostAsync(string host, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(host))
            return null;

        // Normalize: lowercase, strip port
        var normalizedHost = NormalizeHost(host);
        var cacheKey = $"{CacheKeyPrefix}{normalizedHost}";

        // Try cache first
        if (cache.TryGetValue(cacheKey, out TenantInfo? cached))
            return cached;

        // 1. Try exact match on custom_domain (highest priority)
        var tenant = await dbContext.Tenants
            .FirstOrDefaultAsync(
                t => t.CustomDomain == normalizedHost,
                cancellationToken);

        if (tenant?.IsActive == true)
        {
            var info = new TenantInfo(tenant.TenantId, tenant.Slug, true);
            cache.Set(cacheKey, info, _cacheDuration);
            return info;
        }

        // 2. Try to match subdomain against configured base domains
        // E.g., if host is "acme.rclimit.in" and base domains include "rclimit.in",
        // extract "acme" as the slug
        var baseDomain = options.BaseDomains.FirstOrDefault(bd => normalizedHost.EndsWith($".{bd}"));
        if (!string.IsNullOrEmpty(baseDomain))
        {
            var slug = normalizedHost[..^(baseDomain.Length + 1)]; // Remove ".{baseDomain}"
            tenant = await dbContext.Tenants
                .FirstOrDefaultAsync(
                    t => string.Equals(t.Slug, slug, StringComparison.OrdinalIgnoreCase),
                    cancellationToken);

            if (tenant?.IsActive == true)
            {
                var info = new TenantInfo(tenant.TenantId, tenant.Slug, true);
                cache.Set(cacheKey, info, _cacheDuration);
                return info;
            }
        }

        // No match found, cache null result to avoid repeated DB queries
        cache.Set<TenantInfo?>(cacheKey, null, _cacheDuration);
        return null;
    }

    /// <summary>
    /// Normalizes a host string: lowercase and strip port.
    /// </summary>
    private static string NormalizeHost(string host)
    {
        // Remove port if present
        var colonIndex = host.IndexOf(':');
        var cleaned = colonIndex > 0 ? host[..colonIndex] : host;
        return cleaned.ToLowerInvariant();
    }
}

/// <summary>
/// Configuration options for tenant resolution by domain.
/// </summary>
public class TenantResolutionOptions
{
    /// <summary>
    /// Base domains for subdomain-based slug matching.
    /// E.g., ["rclimit.in", "localhost"] allows "acme.rclimit.in" or "acme.localhost" to match slug "acme".
    /// </summary>
    public List<string> BaseDomains { get; set; } = [];
}

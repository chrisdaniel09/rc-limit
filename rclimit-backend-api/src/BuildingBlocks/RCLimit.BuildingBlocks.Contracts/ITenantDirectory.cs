namespace RCLimit.BuildingBlocks.Contracts;

/// <summary>
/// Resolves tenants by domain or slug for multi-tenant request routing.
/// Supports custom domain (e.g., app.acme.com) and subdomain-based routing (e.g., acme.rclimit.in).
/// </summary>
public interface ITenantDirectory
{
    /// <summary>
    /// Finds a tenant by its host (domain or subdomain).
    /// Matches in order: exact custom_domain, then slug under configured base domains.
    /// </summary>
    /// <param name="host">The host to match (e.g., "ashy-hill-006ad3900.4.azurestaticapps.net" or "acme.rclimit.in"). Port is stripped.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>TenantInfo if found and active, null otherwise. Results are cached.</returns>
    Task<TenantInfo?> FindByHostAsync(string host, CancellationToken cancellationToken = default);
}

/// <summary>
/// Tenant information returned from directory lookup.
/// </summary>
public record TenantInfo(Guid TenantId, string Slug, bool IsActive);

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.BuildingBlocks.Infrastructure.Auth;

/// <summary>
/// CSRF checks for endpoints that authenticate with the refresh cookie alone (refresh, logout).
/// Requires the X-CSRF header and an Origin that is allowed by the active profile.
/// </summary>
public sealed class CookieCsrfGuard(
    IOptions<AuthOptions> options,
    ITenantDirectory tenantDirectory,
    IHostEnvironment environment)
{
    public const string HeaderName = "X-CSRF";

    public async Task EnsureAsync(HttpContext context, CancellationToken cancellationToken = default)
    {
        var authOptions = options.Value;

        if (!context.Request.Headers.TryGetValue(HeaderName, out var header) || header != "1")
            throw new ForbiddenException("Missing CSRF protection header.");

        var origin = context.Request.Headers.Origin.ToString();
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var originUri))
            throw new ForbiddenException("Missing or invalid Origin header.");

        if (originUri.Scheme != Uri.UriSchemeHttps && !environment.IsDevelopment())
            throw new ForbiddenException("Origin must use HTTPS.");

        if (authOptions.DeploymentProfile == DeploymentProfile.SameSite)
        {
            // Same-origin: the Origin must be the host the edge served the tenant on.
            var tenantHost = RequestHostResolver.TenantHost(context, authOptions);
            if (tenantHost is null || !string.Equals(originUri.Host, tenantHost, StringComparison.OrdinalIgnoreCase))
                throw new ForbiddenException("Origin not allowed.");
            return;
        }

        // Cross-site: the Origin must be an allowlisted UI origin, or an active tenant domain (same rule as CORS).
        var normalizedOrigin = originUri.GetLeftPart(UriPartial.Authority);
        var isAllowlisted = authOptions.CorsAllowedOrigins.Any(allowed =>
            string.Equals(allowed.TrimEnd('/'), normalizedOrigin, StringComparison.OrdinalIgnoreCase));

        if (!isAllowlisted)
        {
            var tenant = await tenantDirectory.FindByHostAsync(originUri.Host, cancellationToken);
            if (tenant is null)
                throw new ForbiddenException("Origin not allowed.");
        }
    }
}

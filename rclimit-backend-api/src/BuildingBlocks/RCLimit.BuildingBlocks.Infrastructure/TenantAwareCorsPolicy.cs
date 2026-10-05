using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using RCLimit.BuildingBlocks.Contracts;

namespace RCLimit.BuildingBlocks.Infrastructure;

/// <summary>
/// Custom CORS policy provider that allows origins for any active tenant domain,
/// plus any additional statically configured allowed origins.
/// </summary>
public class TenantAwareCorsPolicy : ICorsPolicyProvider
{
    private readonly ITenantDirectory _tenantDirectory;
    private readonly string[] _staticAllowedOrigins;

    public TenantAwareCorsPolicy(ITenantDirectory tenantDirectory, string[] staticAllowedOrigins)
    {
        _tenantDirectory = tenantDirectory;
        _staticAllowedOrigins = staticAllowedOrigins;
    }

    public async Task<CorsPolicy?> GetPolicyAsync(HttpContext context, string? policyName)
    {
        var policy = new CorsPolicyBuilder()
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();

        // Add static origins
        foreach (var origin in _staticAllowedOrigins)
        {
            policy.WithOrigins(origin);
        }

        // Try to resolve the request's origin domain
        if (context.Request.Headers.TryGetValue("Origin", out var originHeader))
        {
            if (Uri.TryCreate(originHeader.ToString(), UriKind.Absolute, out var uri))
            {
                var host = uri.Host;
                var tenant = await _tenantDirectory.FindByHostAsync(host, context.RequestAborted);

                // Allow if the origin matches an active tenant domain
                if (tenant?.IsActive == true)
                {
                    policy.WithOrigins(originHeader.ToString());
                }
            }
        }

        return policy.Build();
    }
}

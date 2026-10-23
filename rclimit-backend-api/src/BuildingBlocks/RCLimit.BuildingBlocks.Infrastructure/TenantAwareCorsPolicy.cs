using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Auth;

namespace RCLimit.BuildingBlocks.Infrastructure;

/// <summary>
/// CORS policy by deployment profile.
/// SameSite: no cross-origin access at all (the browser never calls the API cross-origin).
/// CrossSite: the configured UI origins plus the origin of any active tenant, with credentials.
/// </summary>
public class TenantAwareCorsPolicy(ITenantDirectory tenantDirectory, IOptions<AuthOptions> options) : ICorsPolicyProvider
{
    public async Task<CorsPolicy?> GetPolicyAsync(HttpContext context, string? policyName)
    {
        var authOptions = options.Value;

        var policy = new CorsPolicyBuilder()
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();

        if (authOptions.DeploymentProfile == DeploymentProfile.SameSite)
            return policy.Build();

        foreach (var origin in authOptions.CorsAllowedOrigins)
            policy.WithOrigins(origin);

        if (context.Request.Headers.TryGetValue("Origin", out var originHeader)
            && Uri.TryCreate(originHeader.ToString(), UriKind.Absolute, out var uri))
        {
            var tenant = await tenantDirectory.FindByHostAsync(uri.Host, context.RequestAborted);
            if (tenant?.IsActive == true)
                policy.WithOrigins(originHeader.ToString());
        }

        return policy.Build();
    }
}

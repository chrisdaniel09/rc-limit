using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.BuildingBlocks.Infrastructure;

/// <summary>
/// Middleware that resolves the tenant for each request based on the request domain (Origin header or Host header).
/// For authenticated requests, validates that the resolved tenant matches the JWT tenant_id claim.
/// For anonymous requests, sets the TenantContext so login and register know which tenant to use.
/// </summary>
public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(
        HttpContext context,
        TenantContext tenantContext,
        ITenantDirectory tenantDirectory)
    {
        // Resolve tenant from request domain
        var resolvedTenant = await ResolveTenantFromRequestAsync(context, tenantDirectory);

        // Enforce constraints based on request type
        if (context.User.Identity?.IsAuthenticated == true)
        {
            // Authenticated request: tenant from JWT takes precedence, but must match resolved domain
            var tenantClaim = context.User.FindFirstValue("tenant_id");
            if (Guid.TryParse(tenantClaim, out var jwtTenantId))
            {
                tenantContext.TenantId = jwtTenantId;

                // If domain resolved to a different tenant, reject it
                if (resolvedTenant?.TenantId != Guid.Empty && resolvedTenant?.TenantId != jwtTenantId)
                    throw new ForbiddenException("The domain does not match your tenant.");
            }

            var userClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userClaim, out var userId))
                tenantContext.UserId = userId;
        }
        else
        {
            // Anonymous request (login, register, refresh): use resolved domain tenant
            if (resolvedTenant?.IsActive == true)
                tenantContext.TenantId = resolvedTenant.TenantId;
        }

        await _next(context);
    }

    /// <summary>
    /// Extracts the host from the request and resolves it to a tenant.
    /// Tries Origin header first (for CORS calls), then Host header.
    /// Returns null if the tenant is inactive or not found.
    /// </summary>
    private static async Task<TenantInfo?> ResolveTenantFromRequestAsync(
        HttpContext context,
        ITenantDirectory tenantDirectory)
    {
        var host = ExtractHost(context);
        if (string.IsNullOrWhiteSpace(host))
            return null;

        return await tenantDirectory.FindByHostAsync(host, context.RequestAborted);
    }

    /// <summary>
    /// Extracts the host from Origin header (first) or Host header (fallback).
    /// </summary>
    private static string? ExtractHost(HttpContext context)
    {
        // Try Origin header first (browser CORS request)
        if (context.Request.Headers.TryGetValue("Origin", out var origin))
        {
            if (!string.IsNullOrWhiteSpace(origin) && Uri.TryCreate(origin.ToString(), UriKind.Absolute, out var uri))
                return uri.Host;
        }

        // Fall back to Host header
        if (context.Request.Headers.TryGetValue("Host", out var host) && !string.IsNullOrWhiteSpace(host))
            return host.ToString();

        return null;
    }
}

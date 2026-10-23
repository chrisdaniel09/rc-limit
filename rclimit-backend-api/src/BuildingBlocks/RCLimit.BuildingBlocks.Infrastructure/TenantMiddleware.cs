using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Infrastructure.Auth;

namespace RCLimit.BuildingBlocks.Infrastructure;

/// <summary>
/// Binds every /api request to exactly one active tenant and fails closed.
/// The tenant host comes from the active deployment profile (see <see cref="RequestHostResolver"/>).
/// For authenticated requests the JWT tenant_id must match that tenant.
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
        ITenantDirectory tenantDirectory,
        IOptions<AuthOptions> options)
    {
        if (!context.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var authOptions = options.Value;

        if (authOptions.EdgeEnforced && !RequestHostResolver.IsFromEdge(context, authOptions))
            throw new ForbiddenException("Requests must come through the edge.");

        var host = RequestHostResolver.TenantHost(context, authOptions);
        var tenant = host is null
            ? null
            : await tenantDirectory.FindByHostAsync(host, context.RequestAborted);

        if (tenant is null)
        {
            if (context.Request.Path.StartsWithSegments("/api/v1/auth", StringComparison.OrdinalIgnoreCase))
                throw new NotFoundException("Tenant", host ?? "(no host)");

            throw new ForbiddenException("The request host does not belong to an active tenant.");
        }

        if (context.User.Identity?.IsAuthenticated == true)
        {
            var tokenTenant = context.User.FindFirstValue("tenant_id");
            if (!Guid.TryParse(tokenTenant, out var jwtTenantId) || jwtTenantId != tenant.TenantId)
                throw new ForbiddenException("The domain does not match your tenant.");

            if (Guid.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
                tenantContext.UserId = userId;
        }

        tenantContext.TenantId = tenant.TenantId;
        await _next(context);
    }
}

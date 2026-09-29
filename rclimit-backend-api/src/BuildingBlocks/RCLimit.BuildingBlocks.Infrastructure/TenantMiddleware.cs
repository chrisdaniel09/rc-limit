using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace RCLimit.BuildingBlocks.Infrastructure;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;

    public TenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, TenantContext tenantContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var tenantClaim = context.User.FindFirstValue("tenant_id");
            if (Guid.TryParse(tenantClaim, out var tenantId))
                tenantContext.TenantId = tenantId;

            var userClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userClaim, out var userId))
                tenantContext.UserId = userId;
        }

        await _next(context);
    }
}

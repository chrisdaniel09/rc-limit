using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Serilog;

namespace RCLimit.BuildingBlocks.Infrastructure.Middleware;

public class DiagnosticContextMiddleware
{
    private readonly RequestDelegate _next;

    public DiagnosticContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IDiagnosticContext diagnosticContext)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var tenantId = context.User.FindFirstValue("tenant_id");
            var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (tenantId is not null)
                diagnosticContext.Set("TenantId", tenantId);
            if (userId is not null)
                diagnosticContext.Set("UserId", userId);
        }

        await _next(context);
    }
}

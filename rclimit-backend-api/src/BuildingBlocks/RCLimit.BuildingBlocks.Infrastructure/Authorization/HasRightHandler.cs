using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace RCLimit.BuildingBlocks.Infrastructure.Authorization;

public class HasRightHandler : AuthorizationHandler<HasRightRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        HasRightRequirement requirement)
    {
        var user = context.User;

        if (!user.Identity?.IsAuthenticated ?? false)
        {
            context.Fail();
            return Task.CompletedTask;
        }

        var isSuperAdmin = user.FindAll(ClaimTypes.Role)
            .Any(c => c.Value.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase));

        if (isSuperAdmin)
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        if (requirement.Right == null)
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var hasRight = user.FindAll("right")
            .Any(c => c.Value.Equals(requirement.Right, StringComparison.OrdinalIgnoreCase));

        if (hasRight)
        {
            context.Succeed(requirement);
        }
        else
        {
            context.Fail();
        }

        return Task.CompletedTask;
    }
}

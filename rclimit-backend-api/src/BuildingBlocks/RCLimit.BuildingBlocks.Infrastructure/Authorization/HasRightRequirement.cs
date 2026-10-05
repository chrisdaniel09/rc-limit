using Microsoft.AspNetCore.Authorization;

namespace RCLimit.BuildingBlocks.Infrastructure.Authorization;

public class HasRightRequirement : IAuthorizationRequirement
{
    public string? Right { get; set; }

    public HasRightRequirement(string? right = null)
    {
        Right = right;
    }
}

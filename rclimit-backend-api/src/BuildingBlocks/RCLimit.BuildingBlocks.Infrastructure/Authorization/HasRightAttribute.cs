using Microsoft.AspNetCore.Authorization;

namespace RCLimit.BuildingBlocks.Infrastructure.Authorization;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class HasRightAttribute : AuthorizeAttribute
{
    public HasRightAttribute(string right)
    {
        Policy = $"HasRight:{right}";
    }
}

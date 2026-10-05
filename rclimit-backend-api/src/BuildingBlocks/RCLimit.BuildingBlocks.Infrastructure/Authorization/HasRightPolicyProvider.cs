using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace RCLimit.BuildingBlocks.Infrastructure.Authorization;

public class HasRightPolicyProvider : IAuthorizationPolicyProvider
{
    private const string POLICY_PREFIX = "HasRight:";
    private readonly DefaultAuthorizationPolicyProvider _fallbackPolicyProvider;

    public HasRightPolicyProvider(IOptions<AuthorizationOptions> options)
    {
        _fallbackPolicyProvider = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(POLICY_PREFIX, StringComparison.OrdinalIgnoreCase))
        {
            var rightCode = policyName.Substring(POLICY_PREFIX.Length);
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new HasRightRequirement(rightCode))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return _fallbackPolicyProvider.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync()
    {
        return _fallbackPolicyProvider.GetDefaultPolicyAsync();
    }

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync()
    {
        return _fallbackPolicyProvider.GetFallbackPolicyAsync();
    }
}

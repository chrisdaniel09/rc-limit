namespace RCLimit.BuildingBlocks.Contracts.Auth;

/// <summary>
/// Effective session lifetimes for one tenant, after defaults and clamping.
/// </summary>
public sealed record TenantSessionPolicy(
    int AccessTokenMinutes,
    int IdleTimeoutDays,
    int AbsoluteTimeoutDays,
    int? MaxSessionsPerUser);

public interface ITenantSessionPolicyProvider
{
    Task<TenantSessionPolicy> GetAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>Drops the cached policy for a tenant. Call after its settings change.</summary>
    void Invalidate(Guid tenantId);
}

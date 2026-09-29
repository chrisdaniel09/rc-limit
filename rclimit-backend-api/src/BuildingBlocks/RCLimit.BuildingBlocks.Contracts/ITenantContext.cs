namespace RCLimit.BuildingBlocks.Contracts;

public interface ITenantContext
{
    Guid TenantId { get; }
    Guid UserId { get; }
}

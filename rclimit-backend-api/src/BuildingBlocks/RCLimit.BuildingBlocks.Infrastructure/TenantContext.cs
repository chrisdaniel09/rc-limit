using RCLimit.BuildingBlocks.Contracts;

namespace RCLimit.BuildingBlocks.Infrastructure;

public class TenantContext : ITenantContext
{
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
}

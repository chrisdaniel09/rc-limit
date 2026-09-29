namespace RCLimit.Modules.System.Domain.Entities;

public class Tenant
{
    public Guid TenantId { get; set; } = Guid.NewGuid();
    public string OrganizationName { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? CustomDomain { get; set; }
    public string SubscriptionPlan { get; set; } = "ENTERPRISE";
    public bool IsActive { get; set; } = true;
    public string? DatabaseConnectionString { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public TenantSettings? Settings { get; set; }
}

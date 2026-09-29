namespace RCLimit.Modules.Partners.Domain.Entities;

public class Partner
{
    public Guid PartnerId { get; set; }
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string PartnerType { get; set; } = "SUB_BROKER";
    public string LegalName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public decimal DefaultCommissionSplitPct { get; set; } = 70.00m;
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

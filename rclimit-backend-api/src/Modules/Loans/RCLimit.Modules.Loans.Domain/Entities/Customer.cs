namespace RCLimit.Modules.Loans.Domain.Entities;

public class Customer
{
    public Guid CustomerId { get; set; }
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string CustomerType { get; set; } = "DEALER";
    public string LegalName { get; set; } = string.Empty;
    public string? TradeName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? PanNumber { get; set; }
    public string? Gstin { get; set; }
    public int? CibilScore { get; set; }
    public string? CibilTier { get; set; }
    public string KycStatus { get; set; } = "PENDING";
    public string RiskStatus { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public CustomerSubLimit? SubLimit { get; set; }
    public ICollection<Vehicle> Vehicles { get; set; } = new List<Vehicle>();
}

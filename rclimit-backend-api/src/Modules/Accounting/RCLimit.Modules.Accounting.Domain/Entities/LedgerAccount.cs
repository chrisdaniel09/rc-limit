namespace RCLimit.Modules.Accounting.Domain.Entities;

public class LedgerAccount
{
    public Guid AccountId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty; // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
    public string Currency { get; set; } = "INR";
    public bool IsActive { get; set; } = true;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? UpdatedByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

namespace RCLimit.Modules.Loans.Domain.Entities;

public class MasterBankPool
{
    public Guid PoolId { get; set; }
    public Guid TenantId { get; set; }
    public Guid LenderId { get; set; }
    public string FacilityAccountNumber { get; set; } = string.Empty;
    public decimal SanctionedLimit { get; set; }
    public decimal UtilizedAmount { get; set; }
    public DateOnly? SanctionDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Lender Lender { get; set; } = null!;
}

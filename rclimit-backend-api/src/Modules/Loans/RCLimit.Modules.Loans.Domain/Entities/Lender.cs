namespace RCLimit.Modules.Loans.Domain.Entities;

public class Lender
{
    public Guid LenderId { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public decimal BaseInterestRate { get; set; }
    public int DefaultTenureLimitDays { get; set; } = 45;
    public string? ContactPersonDetails { get; set; }
    public string Status { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<MasterBankPool> MasterBankPools { get; set; } = new List<MasterBankPool>();
}

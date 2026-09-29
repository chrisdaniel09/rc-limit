namespace RCLimit.Modules.Loans.Domain.Entities;

public class LoanTransaction
{
    public Guid LoanId { get; set; }
    public Guid TenantId { get; set; }
    public int SerialNumber { get; set; }
    public string? LoanNumber { get; set; }
    public string? LenderAgreementNumber { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid PoolId { get; set; }
    public Guid? PartnerId { get; set; }
    public string ProductType { get; set; } = "USED_CV";
    public decimal SanctionedAmount { get; set; }
    public decimal NetDisbursedAmount { get; set; }
    public decimal CustomerRate { get; set; }
    public decimal BankPayoutPctAmt { get; set; }
    public decimal BonusPayoutAmt { get; set; }
    public decimal SharedPayoutAmt { get; set; }
    public decimal TotalPayoutEarned { get; set; }
    public string LoanStatus { get; set; } = "DISBURSED_RC_PENDING";
    public DateOnly DisbursalDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Customer Customer { get; set; } = null!;
    public Vehicle Vehicle { get; set; } = null!;
    public MasterBankPool Pool { get; set; } = null!;
    public ICollection<DisbursalLineItem> DisbursalLineItems { get; set; } = new List<DisbursalLineItem>();
    public RcPipelineTracker? RcTracker { get; set; }
}

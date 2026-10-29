using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Domain.Entities;

public class LoanTransaction
{
    public Guid LoanId { get; set; }
    public Guid TenantId { get; set; }
    public int SerialNumber { get; set; }
    public string ApplicationNumber { get; set; } = string.Empty;
    public string? LenderAgreementNumber { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid PoolId { get; set; }
    public Guid? PartnerId { get; set; }
    public string ProductType { get; set; } = "USED_CV";
    public decimal RequestedAmount { get; set; }

    // Set at SANCTIONED. Null before that.
    public decimal? SanctionedAmount { get; set; }
    public int? TenureMonths { get; set; }
    public decimal CustomerRate { get; set; }

    // The Anna Finance balance: the running balance after the latest ledger entry.
    public decimal NetDisbursedAmount { get; set; }
    public decimal BankPayoutPctAmt { get; set; }
    public decimal BonusPayoutAmt { get; set; }
    public decimal SharedPayoutAmt { get; set; }
    public decimal TotalPayoutEarned { get; set; }

    public string LoanStatus { get; set; } = LoanStatuses.New;

    public DateOnly? LoggedInDate { get; set; }
    public DateOnly? SanctionDate { get; set; }
    public DateOnly? DisbursalDate { get; set; }
    public DateOnly? EmiStartDate { get; set; }
    public int? EmiDueDay { get; set; }
    public DateOnly? PddDueDate { get; set; }
    public DateOnly? ClosedDate { get; set; }
    public DateOnly? RejectionWithdrawnDate { get; set; }
    public string? RejectionWithdrawnReason { get; set; }

    public string? Remarks { get; set; }
    public Guid? PostDisbursementDocumentStatusId { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Row version (PostgreSQL xmin). A concurrent change to the same loan fails on save.
    public uint Version { get; set; }

    public Customer Customer { get; set; } = null!;
    public Vehicle Vehicle { get; set; } = null!;
    public MasterBankPool Pool { get; set; } = null!;
    public PostDisbursementDocumentStatus? DocumentStatus { get; set; }
    public ICollection<DisbursalLineItem> DisbursalLineItems { get; set; } = new List<DisbursalLineItem>();
    public RcPipelineTracker? RcTracker { get; set; }
}

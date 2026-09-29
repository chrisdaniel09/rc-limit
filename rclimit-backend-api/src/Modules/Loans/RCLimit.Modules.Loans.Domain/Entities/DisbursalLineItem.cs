namespace RCLimit.Modules.Loans.Domain.Entities;

public class DisbursalLineItem
{
    public Guid LineItemId { get; set; }
    public Guid LoanId { get; set; }
    public DateOnly EntryDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string ParticularType { get; set; } = string.Empty;
    public string? ModeOfPayment { get; set; }
    public string? BankName { get; set; }
    public string? AccountNo { get; set; }
    public string? TransactionId { get; set; }
    public decimal DebitAmount { get; set; }
    public decimal RunningBalanceAmt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public LoanTransaction LoanTransaction { get; set; } = null!;
}

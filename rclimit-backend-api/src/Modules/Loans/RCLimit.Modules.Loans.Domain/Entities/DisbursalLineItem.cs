namespace RCLimit.Modules.Loans.Domain.Entities;

// One ledger entry: a bank credit or a debit from the Anna Finance balance (spec section 4).
public class DisbursalLineItem
{
    public Guid LineItemId { get; set; }
    public Guid LoanId { get; set; }
    public DateOnly EntryDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);

    // CREDIT or DEBIT. Recipient for a credit, payee for a debit, held in Counterparty.
    public string EntryDirection { get; set; } = "DEBIT";
    public string Counterparty { get; set; } = "ANNA_FINANCE";
    public string ParticularType { get; set; } = string.Empty;
    public string? ModeOfPayment { get; set; }
    public string? BankName { get; set; }
    public string? AccountNo { get; set; }
    public string? TransactionId { get; set; }
    public decimal Amount { get; set; }
    public decimal RunningBalanceAmt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public LoanTransaction LoanTransaction { get; set; } = null!;
}

namespace RCLimit.Modules.Accounting.Domain.Entities;

public class LedgerLineItem
{
    public Guid LineItemId { get; set; } = Guid.NewGuid();
    public Guid JournalId { get; set; }
    public Guid AccountId { get; set; }
    public string EntryDirection { get; set; } = string.Empty; // DEBIT or CREDIT
    public decimal Amount { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public JournalEntry JournalEntry { get; set; } = null!;
    public LedgerAccount LedgerAccount { get; set; } = null!;
}

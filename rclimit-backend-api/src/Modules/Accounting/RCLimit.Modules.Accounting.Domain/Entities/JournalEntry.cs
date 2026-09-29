namespace RCLimit.Modules.Accounting.Domain.Entities;

public class JournalEntry
{
    public Guid JournalId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public int EntryNumber { get; set; }
    public DateOnly EntryDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public Guid ReferenceId { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string Narration { get; set; } = string.Empty;
    public Guid CreatedByUserId { get; set; }
    public string PostedByRole { get; set; } = string.Empty;
    public string SourceModule { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<LedgerLineItem> LineItems { get; set; } = [];
}

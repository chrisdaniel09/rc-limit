namespace RCLimit.Modules.Accounting.Domain.Entities;

public class PostingRule
{
    public Guid RuleId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string ParticularType { get; set; } = string.Empty;
    public Guid DebitAccountId { get; set; }
    public Guid CreditAccountId { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public LedgerAccount DebitAccount { get; set; } = null!;
    public LedgerAccount CreditAccount { get; set; } = null!;
}

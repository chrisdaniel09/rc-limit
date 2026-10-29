namespace RCLimit.Modules.Loans.Domain.Entities;

// A message the Loans module sends to another module. It is written in the same transaction as the change
// that causes it, and is published after commit by the outbox dispatcher.
public class LoanOutboxMessage
{
    public Guid MessageId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public string Payload { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public int Attempts { get; set; }
    public string? LastError { get; set; }
}

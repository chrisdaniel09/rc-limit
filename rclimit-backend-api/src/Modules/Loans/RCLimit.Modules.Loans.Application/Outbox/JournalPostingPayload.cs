namespace RCLimit.Modules.Loans.Application.Outbox;

// Payload of a JOURNAL_POSTING_REQUESTED message. The Accounting module posts the entry from it.
public record JournalPostingPayload(
    Guid TenantId,
    Guid LoanId,
    string ParticularType,
    decimal Amount,
    string Narration,
    Guid CreatedByUserId);

public static class LoanOutboxEvents
{
    public const string JournalPostingRequested = "JOURNAL_POSTING_REQUESTED";
}

namespace RCLimit.Modules.Accounting.Contracts.Dtos;

public record PostJournalRequest(
    Guid TenantId,
    Guid ReferenceId,
    string TransactionType,
    string Narration,
    Guid CreatedByUserId,
    string PostedByRole,
    string SourceModule,
    List<JournalLineRequest> Lines);

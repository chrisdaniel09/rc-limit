namespace RCLimit.Modules.Accounting.Application.Dtos;

public record JournalEntryDto(
    Guid JournalId,
    int EntryNumber,
    DateOnly EntryDate,
    string TransactionType,
    string Narration,
    DateTime CreatedAt,
    List<LedgerLineItemDto> LineItems);

public record LedgerLineItemDto(
    Guid LineItemId,
    Guid AccountId,
    string AccountCode,
    string EntryDirection,
    decimal Amount);

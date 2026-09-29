namespace RCLimit.Modules.Accounting.Application.Dtos;

public record LedgerAccountDto(
    Guid AccountId,
    string AccountCode,
    string AccountName,
    string AccountType,
    string Currency,
    bool IsActive);

namespace RCLimit.Modules.Accounting.Application.Dtos;

public record PostingRuleDto(
    Guid RuleId,
    string ParticularType,
    Guid DebitAccountId,
    string DebitAccountCode,
    string DebitAccountName,
    Guid CreditAccountId,
    string CreditAccountCode,
    string CreditAccountName,
    string TransactionType,
    string? Description,
    bool IsActive);

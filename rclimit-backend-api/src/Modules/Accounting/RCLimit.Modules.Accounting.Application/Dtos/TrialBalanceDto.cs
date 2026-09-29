namespace RCLimit.Modules.Accounting.Application.Dtos;

public record TrialBalanceDto(List<TrialBalanceLineDto> Lines, decimal TotalDebits, decimal TotalCredits);

public record TrialBalanceLineDto(
    Guid AccountId,
    string AccountCode,
    string AccountName,
    string AccountType,
    decimal DebitTotal,
    decimal CreditTotal);

namespace RCLimit.Modules.Loans.Application.Lenders;

public record LenderDto(
    Guid LenderId,
    string Name,
    string Code,
    decimal BaseInterestRate,
    int DefaultTenureLimitDays,
    string Status);

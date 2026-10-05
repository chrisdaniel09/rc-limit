namespace RCLimit.Modules.Loans.Application.LenderDisbursedToOptions;

public record LenderDisbursedToOptionDto(
    Guid OptionId,
    string Code,
    string Label,
    int SortOrder,
    bool IsActive);

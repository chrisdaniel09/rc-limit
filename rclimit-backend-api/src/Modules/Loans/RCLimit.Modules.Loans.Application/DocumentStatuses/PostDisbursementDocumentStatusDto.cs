namespace RCLimit.Modules.Loans.Application.DocumentStatuses;

public record PostDisbursementDocumentStatusDto(
    Guid DocumentStatusId,
    string Code,
    string Label,
    int SortOrder,
    bool IsActive);

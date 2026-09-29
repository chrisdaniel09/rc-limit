namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

public record DisbursalParticularTypeDto(
    Guid ParticularTypeId,
    string Code,
    string Label,
    int SortOrder,
    bool IsActive);

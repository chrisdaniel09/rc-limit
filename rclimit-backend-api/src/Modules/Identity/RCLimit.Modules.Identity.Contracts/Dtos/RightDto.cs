namespace RCLimit.Modules.Identity.Contracts.Dtos;

public record RightDto(
    Guid RightId,
    string Code,
    string Module,
    string Name,
    string? Description,
    bool IsActive);

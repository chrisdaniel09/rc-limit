namespace RCLimit.Modules.Identity.Contracts.Dtos;

public record RoleDto(
    Guid RoleId,
    string Code,
    string Name,
    string? Description,
    bool IsSystem,
    bool IsActive,
    List<RightDto> Rights);

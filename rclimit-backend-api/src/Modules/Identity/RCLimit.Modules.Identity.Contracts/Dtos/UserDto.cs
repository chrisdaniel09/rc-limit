namespace RCLimit.Modules.Identity.Contracts.Dtos;

public record UserDto(
    Guid UserId,
    Guid TenantId,
    string? Email,
    string? FullName,
    List<RoleDto> Roles = null,
    List<string> RightCodes = null);

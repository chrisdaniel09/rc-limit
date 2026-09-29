namespace RCLimit.Modules.Identity.Contracts.Dtos;

public record UserDto(
    Guid UserId,
    Guid TenantId,
    string? Email,
    string? FullName);

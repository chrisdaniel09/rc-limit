using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Dtos;

namespace RCLimit.Modules.Identity.Application.Commands;

public record RegisterCommand(
    string Email,
    string Password,
    string FullName,
    string? PhoneNumber,
    Guid TenantId) : ICommand<AuthResponse>;

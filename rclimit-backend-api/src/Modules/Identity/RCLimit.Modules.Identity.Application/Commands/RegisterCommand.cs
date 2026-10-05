using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Dtos;

namespace RCLimit.Modules.Identity.Application.Commands;

/// <summary>
/// Register a new user in the current tenant (resolved from request domain via middleware).
/// TenantId is injected from ITenantContext, not from the client request.
/// </summary>
public record RegisterCommand(
    string Email,
    string Password,
    string FullName,
    string? PhoneNumber) : ICommand<AuthResponse>;

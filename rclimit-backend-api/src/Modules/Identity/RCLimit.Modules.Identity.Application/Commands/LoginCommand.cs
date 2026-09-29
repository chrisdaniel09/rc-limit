using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Dtos;

namespace RCLimit.Modules.Identity.Application.Commands;

public record LoginCommand(string Email, string Password) : ICommand<AuthResponse>;

using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Dtos;

namespace RCLimit.Modules.Identity.Application.Commands;

public record RefreshTokenCommand(string RefreshToken, string? IpAddress, string? UserAgent) : ICommand<AuthResponse>;

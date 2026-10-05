using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Application.Dtos;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.Modules.Identity.Application.Commands;

public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponse>
{
    private readonly IIdentityDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtService;

    public LoginCommandHandler(
        IIdentityDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtService)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
    }

    public async Task<AuthResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email, cancellationToken)
            ?? throw new InvalidOperationException("Invalid email or password.");

        if (!user.IsActive)
            throw new InvalidOperationException("Account is deactivated.");

        if (user.PasswordHash is null || user.PasswordSalt is null)
            throw new InvalidOperationException("Invalid email or password.");

        if (!_passwordHasher.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt))
            throw new InvalidOperationException("Invalid email or password.");

        user.RecordLogin();

        var userRoleIds = await _db.UserRoles
            .Where(ur => ur.UserId == user.UserId)
            .Select(ur => ur.RoleId)
            .ToListAsync(cancellationToken);

        var roles = await _db.Roles
            .Where(r => userRoleIds.Contains(r.RoleId))
            .ToListAsync(cancellationToken);

        var roleNames = roles.Select(r => r.Name).ToList();

        var roleRights = await _db.RoleRights
            .Where(rr => userRoleIds.Contains(rr.RoleId))
            .ToListAsync(cancellationToken);

        var rightIds = roleRights.Select(rr => rr.RightId).Distinct().ToList();
        var rights = await _db.Rights
            .Where(r => rightIds.Contains(r.RightId))
            .ToListAsync(cancellationToken);

        var rightCodes = rights.Select(r => r.Code).ToList();

        var accessToken = _jwtService.GenerateAccessToken(user, roleNames, rightCodes);
        var refreshTokenValue = _jwtService.GenerateRefreshToken();
        var expiresAt = DateTime.UtcNow.AddDays(7);

        var refreshToken = RefreshToken.Create(
            user.UserId,
            ComputeTokenHash(refreshTokenValue),
            expiresAt);

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync(cancellationToken);

        var userRoleDtos = roles.Select(r => new RoleDto(
            r.RoleId,
            r.Code,
            r.Name,
            r.Description,
            r.IsSystem,
            r.IsActive,
            new List<RightDto>()
        )).ToList();

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15),
            new UserDto(user.UserId, user.TenantId, user.Email, user.FullName, userRoleDtos, rightCodes));
    }

    private static string ComputeTokenHash(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}

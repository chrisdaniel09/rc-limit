using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Application.Dtos;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Commands;

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResponse>
{
    private readonly IIdentityDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtService;
    private readonly ITenantContext _tenantContext;

    public RegisterCommandHandler(
        IIdentityDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtService,
        ITenantContext tenantContext)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
        _tenantContext = tenantContext;
    }

    public async Task<AuthResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContext.TenantId;

        // Tenant must be resolved from the request domain by middleware
        if (tenantId == Guid.Empty)
            throw new BusinessRuleException("Tenant could not be resolved from the request domain.");

        // Check email uniqueness within this tenant only
        var existingUser = await _db.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == tenantId, cancellationToken);

        if (existingUser is not null)
            throw new InvalidOperationException("A user with this email already exists in this tenant.");

        var (hash, salt) = _passwordHasher.HashPassword(request.Password);

        var user = User.Create(
            tenantId,
            request.Email,
            request.FullName,
            request.PhoneNumber,
            hash,
            salt);

        _db.Users.Add(user);

        var accessToken = _jwtService.GenerateAccessToken(user);
        var refreshTokenValue = _jwtService.GenerateRefreshToken();
        var expiresAt = DateTime.UtcNow.AddDays(7);

        var refreshToken = RefreshToken.Create(
            user.UserId,
            ComputeTokenHash(refreshTokenValue),
            expiresAt);

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync(cancellationToken);

        return new AuthResponse(
            accessToken,
            refreshTokenValue,
            DateTime.UtcNow.AddMinutes(15),
            new UserDto(user.UserId, user.TenantId, user.Email, user.FullName));
    }

    private static string ComputeTokenHash(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}

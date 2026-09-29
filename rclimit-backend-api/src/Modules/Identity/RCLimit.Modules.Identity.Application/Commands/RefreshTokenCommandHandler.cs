using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Application.Dtos;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Commands;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    private readonly IIdentityDbContext _db;
    private readonly IJwtTokenService _jwtService;

    public RefreshTokenCommandHandler(IIdentityDbContext db, IJwtTokenService jwtService)
    {
        _db = db;
        _jwtService = jwtService;
    }

    public async Task<AuthResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeTokenHash(request.RefreshToken);

        var existingToken = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash, cancellationToken)
            ?? throw new InvalidOperationException("Invalid refresh token.");

        if (existingToken.IsRevoked)
        {
            // Possible token reuse detected — revoke all tokens for this user
            var allTokens = await _db.RefreshTokens
                .Where(r => r.UserId == existingToken.UserId && !r.IsRevoked)
                .ToListAsync(cancellationToken);

            foreach (var t in allTokens)
                t.Revoke();

            await _db.SaveChangesAsync(cancellationToken);
            throw new InvalidOperationException("Token reuse detected. All sessions revoked.");
        }

        if (existingToken.IsExpired)
        {
            existingToken.Revoke();
            await _db.SaveChangesAsync(cancellationToken);
            throw new InvalidOperationException("Refresh token has expired.");
        }

        // Rotate: revoke old, issue new
        existingToken.Revoke();

        var user = existingToken.User;
        var newAccessToken = _jwtService.GenerateAccessToken(user);
        var newRefreshTokenValue = _jwtService.GenerateRefreshToken();
        var expiresAt = DateTime.UtcNow.AddDays(7);

        var newRefreshToken = RefreshToken.Create(
            user.UserId,
            ComputeTokenHash(newRefreshTokenValue),
            expiresAt);

        _db.RefreshTokens.Add(newRefreshToken);
        await _db.SaveChangesAsync(cancellationToken);

        return new AuthResponse(
            newAccessToken,
            newRefreshTokenValue,
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

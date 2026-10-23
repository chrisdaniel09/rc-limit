using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Sessions;

/// <summary>Tokens and user data produced by starting or rotating a session.</summary>
public sealed record SessionTokens(
    string AccessToken,
    DateTime AccessExpiresAt,
    string RefreshToken,
    DateTime RefreshExpiresAt,
    UserDto User);

/// <summary>
/// Owns session lifecycle: start, rotate with reuse detection, and revocation by family, user, or session cap.
/// Spec sections 5.3, 6.2 to 6.5.
/// </summary>
public sealed class SessionService(
    IIdentityDbContext db,
    IJwtTokenService jwt,
    ITenantSessionPolicyProvider policies)
{
    public async Task<SessionTokens> StartAsync(User user, string? ipAddress, string? userAgent, CancellationToken cancellationToken)
    {
        var policy = await policies.GetAsync(user.TenantId, cancellationToken);
        var now = DateTime.UtcNow;
        var familyId = Guid.NewGuid();

        if (policy.MaxSessionsPerUser is { } maxSessions)
            await RevokeSessionsOverCapAsync(user.UserId, Math.Max(0, maxSessions - 1), now, cancellationToken);

        var rawToken = RefreshTokens.NewRawToken();
        var refreshExpiresAt = ComputeExpiry(now, now, policy);
        db.RefreshTokens.Add(RefreshToken.Create(
            user.UserId, user.TenantId, familyId, RefreshTokens.Hash(rawToken),
            now, refreshExpiresAt, ipAddress, userAgent));

        var (roles, roleNames, rightCodes) = await LoadClaimsAsync(user.UserId, cancellationToken);
        var accessExpiresAt = now.AddMinutes(policy.AccessTokenMinutes);
        var accessToken = jwt.GenerateAccessToken(user, familyId, roleNames, rightCodes, accessExpiresAt);

        await db.SaveChangesAsync(cancellationToken);

        return new SessionTokens(accessToken, accessExpiresAt, rawToken, refreshExpiresAt,
            ToUserDto(user, roles, rightCodes));
    }

    /// <summary>
    /// Replaces a live refresh token with a new one in the same family. Fails with 409 if another request
    /// rotated the same row first (optimistic concurrency on the row version).
    /// </summary>
    public async Task<SessionTokens> RotateAsync(RefreshToken current, CancellationToken cancellationToken)
    {
        var policy = await policies.GetAsync(current.TenantId, cancellationToken);
        var now = DateTime.UtcNow;
        var expiresAt = ComputeExpiry(current.SessionStartedAt, now, policy);

        if (expiresAt <= now)
        {
            current.Revoke(RefreshRevocationReasons.Expired, now);
            await db.SaveChangesAsync(cancellationToken);
            throw new AuthenticationFailedException(SessionInvalidMessage, "AUTH_SESSION_EXPIRED");
        }

        var rawToken = RefreshTokens.NewRawToken();
        var next = RefreshToken.Create(
            current.UserId, current.TenantId, current.FamilyId, RefreshTokens.Hash(rawToken),
            current.SessionStartedAt, expiresAt, current.IpAddress, current.UserAgent);

        current.Rotate(next.TokenId, now);
        db.RefreshTokens.Add(next);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("Session refresh already in progress. Retry.", "REFRESH_IN_PROGRESS");
        }

        var (roles, roleNames, rightCodes) = await LoadClaimsAsync(current.UserId, cancellationToken);
        var accessExpiresAt = now.AddMinutes(policy.AccessTokenMinutes);
        var accessToken = jwt.GenerateAccessToken(current.User, current.FamilyId, roleNames, rightCodes, accessExpiresAt);

        return new SessionTokens(accessToken, accessExpiresAt, rawToken, expiresAt,
            ToUserDto(current.User, roles, rightCodes));
    }

    public Task RevokeFamilyAsync(Guid familyId, string reason, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return db.RefreshTokens
            .Where(r => r.FamilyId == familyId && !r.IsRevoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.IsRevoked, true)
                .SetProperty(r => r.RevokedAt, now)
                .SetProperty(r => r.RevokedReason, reason), cancellationToken);
    }

    public Task RevokeAllForUserAsync(Guid userId, string reason, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        return db.RefreshTokens
            .Where(r => r.UserId == userId && !r.IsRevoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.IsRevoked, true)
                .SetProperty(r => r.RevokedAt, now)
                .SetProperty(r => r.RevokedReason, reason), cancellationToken);
    }

    public const string SessionInvalidMessage = "Your session has ended. Please sign in again.";

    /// <summary>Sliding idle window, capped by the absolute limit measured from the session start.</summary>
    private static DateTime ComputeExpiry(DateTime sessionStartedAt, DateTime now, TenantSessionPolicy policy)
    {
        var idle = now.AddDays(policy.IdleTimeoutDays);
        var absolute = sessionStartedAt.AddDays(policy.AbsoluteTimeoutDays);
        return idle < absolute ? idle : absolute;
    }

    private async Task RevokeSessionsOverCapAsync(Guid userId, int keep, DateTime now, CancellationToken cancellationToken)
    {
        var stale = await db.RefreshTokens
            .Where(r => r.UserId == userId && !r.IsRevoked && r.ExpiresAt > now)
            .GroupBy(r => r.FamilyId)
            .Select(g => new { FamilyId = g.Key, Started = g.Max(r => r.SessionStartedAt) })
            .OrderByDescending(f => f.Started)
            .Skip(keep)
            .Select(f => f.FamilyId)
            .ToListAsync(cancellationToken);

        foreach (var familyId in stale)
            await RevokeFamilyAsync(familyId, RefreshRevocationReasons.SessionCap, cancellationToken);
    }

    private async Task<(List<RoleDto> Roles, List<string> RoleNames, List<string> RightCodes)> LoadClaimsAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var roleIds = await db.UserRoles
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.RoleId)
            .ToListAsync(cancellationToken);

        var roles = await db.Roles
            .Where(r => roleIds.Contains(r.RoleId))
            .ToListAsync(cancellationToken);

        var roleRights = await db.RoleRights
            .Where(rr => roleIds.Contains(rr.RoleId))
            .ToListAsync(cancellationToken);

        var rightIds = roleRights.Select(rr => rr.RightId).Distinct().ToList();
        var rights = await db.Rights
            .Where(r => rightIds.Contains(r.RightId))
            .ToListAsync(cancellationToken);

        var roleDtos = roles.Select(r => new RoleDto(
            r.RoleId, r.Code, r.Name, r.Description, r.IsSystem, r.IsActive, new List<RightDto>())).ToList();

        return (roleDtos, roles.Select(r => r.Name).ToList(), rights.Select(r => r.Code).ToList());
    }

    private static UserDto ToUserDto(User user, List<RoleDto> roles, List<string> rightCodes) =>
        new(user.UserId, user.TenantId, user.Email, user.FullName, roles, rightCodes);
}

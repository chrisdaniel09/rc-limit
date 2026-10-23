using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Application.Dtos;
using RCLimit.Modules.Identity.Application.Sessions;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Commands;

/// <summary>
/// Rotates a refresh token (spec section 6.3). Classification:
/// active → rotate; rotated within the grace window → 409 (benign concurrent refresh);
/// any other revoked token → reuse, so the whole family is revoked; expired or inactive → family revoked.
/// </summary>
public class RefreshTokenCommandHandler(
    IIdentityDbContext db,
    SessionService sessions,
    ITenantContext tenantContext,
    IOptions<AuthOptions> options,
    ILogger<RefreshTokenCommandHandler> logger) : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    public async Task<AuthResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var hash = RefreshTokens.Hash(request.RefreshToken);

        var row = await db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == hash, cancellationToken)
            ?? throw Invalid();

        if (row.TenantId != tenantContext.TenantId)
        {
            logger.LogWarning("auth.refresh.failure reason={Reason} tenant={TenantId} ip={IpAddress}",
                "tenant_mismatch", tenantContext.TenantId, request.IpAddress);
            throw Invalid();
        }

        if (row.IsRevoked)
        {
            var grace = TimeSpan.FromSeconds(options.Value.Session.ReuseGraceSeconds);
            if (row.RevokedReason == RefreshRevocationReasons.Rotated && row.RevokedAt >= now - grace)
            {
                logger.LogInformation("auth.refresh.conflict tenant={TenantId} user={UserId}",
                    row.TenantId, row.UserId);
                throw new ConflictException("Session refresh already in progress. Retry.", "REFRESH_IN_PROGRESS");
            }

            await sessions.RevokeFamilyAsync(row.FamilyId, RefreshRevocationReasons.ReuseDetected, cancellationToken);
            logger.LogWarning(
                "auth.refresh.reuse_detected tenant={TenantId} user={UserId} family={FamilyId} reason={RevokedReason} ip={IpAddress}",
                row.TenantId, row.UserId, row.FamilyId, row.RevokedReason, request.IpAddress);
            throw Invalid();
        }

        if (!row.User.IsActive)
        {
            await sessions.RevokeFamilyAsync(row.FamilyId, RefreshRevocationReasons.Deactivated, cancellationToken);
            logger.LogWarning("auth.refresh.failure reason={Reason} tenant={TenantId} user={UserId}",
                "inactive", row.TenantId, row.UserId);
            throw Invalid();
        }

        if (row.IsExpired(now))
        {
            await sessions.RevokeFamilyAsync(row.FamilyId, RefreshRevocationReasons.Expired, cancellationToken);
            logger.LogInformation("auth.refresh.failure reason={Reason} tenant={TenantId} user={UserId}",
                "expired", row.TenantId, row.UserId);
            throw Invalid();
        }

        var session = await sessions.RotateAsync(row, cancellationToken);

        logger.LogInformation("auth.refresh.success tenant={TenantId} user={UserId} family={FamilyId} ip={IpAddress}",
            row.TenantId, row.UserId, row.FamilyId, request.IpAddress);

        return new AuthResponse(
            session.AccessToken,
            session.RefreshToken,
            session.AccessExpiresAt,
            session.User,
            session.RefreshExpiresAt);
    }

    private static AuthenticationFailedException Invalid() =>
        new(SessionService.SessionInvalidMessage, "AUTH_SESSION_INVALID");
}

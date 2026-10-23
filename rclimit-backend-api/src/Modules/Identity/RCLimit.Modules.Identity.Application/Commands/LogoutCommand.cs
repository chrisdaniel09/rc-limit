using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Application.Sessions;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Commands;

/// <summary>Revokes the whole session family of the presented refresh token (spec section 6.4).</summary>
public record LogoutCommand(string RefreshToken) : ICommand;

public class LogoutCommandHandler(
    IIdentityDbContext db,
    SessionService sessions,
    ILogger<LogoutCommandHandler> logger) : IRequestHandler<LogoutCommand>
{
    public async Task Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var hash = RefreshTokens.Hash(request.RefreshToken);
        var familyId = await db.RefreshTokens
            .Where(r => r.TokenHash == hash)
            .Select(r => (Guid?)r.FamilyId)
            .FirstOrDefaultAsync(cancellationToken);

        if (familyId is null)
            return;

        await sessions.RevokeFamilyAsync(familyId.Value, RefreshRevocationReasons.Logout, cancellationToken);
        logger.LogInformation("auth.logout family={FamilyId}", familyId.Value);
    }
}

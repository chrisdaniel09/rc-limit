using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Application.Sessions;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Users;

public record ResetUserPasswordCommand(Guid UserId, string NewPassword) : IRequest;

public class ResetUserPasswordCommandHandler(
    IIdentityDbContext db,
    IPasswordHasher passwordHasher,
    SessionService sessions,
    ITenantContext tenant,
    ILogger<ResetUserPasswordCommandHandler> logger) : IRequestHandler<ResetUserPasswordCommand>
{
    public async Task Handle(ResetUserPasswordCommand request, CancellationToken cancellationToken)
    {
        PasswordPolicy.Validate(request.NewPassword);

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.UserId == request.UserId && u.TenantId == tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("User", request.UserId);

        var (hash, salt) = passwordHasher.HashPassword(request.NewPassword);
        user.UpdatePassword(hash, salt);
        user.ClearFailedLogins();

        // A credential reset signs the user out everywhere (spec section 6.5).
        await sessions.RevokeAllForUserAsync(user.UserId, RefreshRevocationReasons.AdminReset, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("auth.password_reset tenant={TenantId} user={UserId}", tenant.TenantId, user.UserId);
    }
}

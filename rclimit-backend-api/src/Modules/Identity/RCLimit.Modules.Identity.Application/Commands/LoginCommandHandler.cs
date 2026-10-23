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

namespace RCLimit.Modules.Identity.Application.Commands;

public class LoginCommandHandler(
    IIdentityDbContext db,
    IPasswordHasher passwordHasher,
    SessionService sessions,
    ITenantContext tenantContext,
    IOptions<AuthOptions> options,
    ILogger<LoginCommandHandler> logger) : IRequestHandler<LoginCommand, AuthResponse>
{
    private const string InvalidCredentials = "Invalid email or password.";

    private static readonly object DummyLock = new();
    private static (string Hash, string Salt)? _dummy;

    public async Task<AuthResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var tenantId = tenantContext.TenantId;
        var email = request.Email.Trim();
        var lockout = options.Value.Lockout;

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Email == email && u.TenantId == tenantId, cancellationToken);

        if (user is null)
        {
            // Run a real verification so an unknown email costs the same time as a wrong password.
            var dummy = DummyHash();
            passwordHasher.VerifyPassword(request.Password, dummy.Hash, dummy.Salt);
            logger.LogWarning("auth.login.failure reason={Reason} tenant={TenantId} ip={IpAddress}",
                "unknown_account", tenantId, request.IpAddress);
            throw InvalidCredentialsException();
        }

        var passwordOk = user.PasswordHash is not null
            && user.PasswordSalt is not null
            && passwordHasher.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt);

        if (user.IsLockedOut(now))
        {
            logger.LogWarning("auth.login.failure reason={Reason} tenant={TenantId} user={UserId} ip={IpAddress}",
                "locked", tenantId, user.UserId, request.IpAddress);
            throw InvalidCredentialsException();
        }

        if (!user.IsActive)
        {
            logger.LogWarning("auth.login.failure reason={Reason} tenant={TenantId} user={UserId} ip={IpAddress}",
                "inactive", tenantId, user.UserId, request.IpAddress);
            throw InvalidCredentialsException();
        }

        if (!passwordOk)
        {
            user.RecordFailedLogin(now, lockout.MaxFailedAttempts, TimeSpan.FromMinutes(lockout.LockoutMinutes));
            await db.SaveChangesAsync(cancellationToken);
            logger.LogWarning("auth.login.failure reason={Reason} tenant={TenantId} user={UserId} ip={IpAddress}",
                "bad_password", tenantId, user.UserId, request.IpAddress);
            throw InvalidCredentialsException();
        }

        user.ClearFailedLogins();
        user.RecordLogin();

        var session = await sessions.StartAsync(user, request.IpAddress, request.UserAgent, cancellationToken);

        logger.LogInformation("auth.login.success tenant={TenantId} user={UserId} ip={IpAddress}",
            tenantId, user.UserId, request.IpAddress);

        return new AuthResponse(
            session.AccessToken,
            session.RefreshToken,
            session.AccessExpiresAt,
            session.User,
            session.RefreshExpiresAt);
    }

    private static AuthenticationFailedException InvalidCredentialsException() =>
        new(InvalidCredentials, "AUTH_INVALID_CREDENTIALS");

    private (string Hash, string Salt) DummyHash()
    {
        lock (DummyLock)
        {
            return _dummy ??= passwordHasher.HashPassword("timing-equaliser-not-a-real-password");
        }
    }
}

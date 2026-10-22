using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Application.Abstractions;

namespace RCLimit.Modules.Identity.Application.Users;

public record ResetUserPasswordCommand(Guid UserId, string NewPassword) : IRequest;

public class ResetUserPasswordCommandHandler : IRequestHandler<ResetUserPasswordCommand>
{
    private readonly IIdentityDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITenantContext _tenant;

    public ResetUserPasswordCommandHandler(IIdentityDbContext db, IPasswordHasher passwordHasher, ITenantContext tenant)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _tenant = tenant;
    }

    public async Task Handle(ResetUserPasswordCommand request, CancellationToken cancellationToken)
    {
        PasswordPolicy.Validate(request.NewPassword);

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.UserId == request.UserId && u.TenantId == _tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("User", request.UserId);

        var (hash, salt) = _passwordHasher.HashPassword(request.NewPassword);
        user.UpdatePassword(hash, salt);

        // Sign the user out everywhere: their existing sessions must not survive a credential reset.
        var activeTokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == user.UserId && !rt.IsRevoked)
            .ToListAsync(cancellationToken);
        foreach (var token in activeTokens)
            token.Revoke();

        await _db.SaveChangesAsync(cancellationToken);
    }
}

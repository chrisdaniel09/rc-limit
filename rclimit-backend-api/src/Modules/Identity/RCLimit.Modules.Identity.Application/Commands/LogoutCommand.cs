using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;

namespace RCLimit.Modules.Identity.Application.Commands;

public record LogoutCommand(string RefreshToken) : ICommand;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand>
{
    private readonly IIdentityDbContext _db;

    public LogoutCommandHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var tokenHash = ComputeTokenHash(request.RefreshToken);

        var token = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash, cancellationToken);

        if (token is not null)
        {
            token.Revoke();
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    private static string ComputeTokenHash(string token)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToBase64String(bytes);
    }
}

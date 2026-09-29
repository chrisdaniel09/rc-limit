using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Infrastructure.Persistence;

namespace RCLimit.Modules.Identity.Infrastructure;

public class IdentityModuleApi : IIdentityModuleApi
{
    private readonly IdentityDbContext _db;

    public IdentityModuleApi(IdentityDbContext db)
    {
        _db = db;
    }

    public async Task<UserDto?> GetUserByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.UserId == userId, cancellationToken);

        return user is null
            ? null
            : new UserDto(user.UserId, user.TenantId, user.Email, user.FullName);
    }

    public async Task<bool> ValidateUserExistsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _db.Users.AnyAsync(u => u.UserId == userId, cancellationToken);
    }
}

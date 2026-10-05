using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Users;

public record SetUserRolesCommand(
    Guid UserId,
    List<Guid> RoleIds) : IRequest<UserDto>;

public class SetUserRolesCommandHandler : IRequestHandler<SetUserRolesCommand, UserDto>
{
    private readonly IIdentityDbContext _db;

    public SetUserRolesCommandHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<UserDto> Handle(SetUserRolesCommand request, CancellationToken cancellationToken)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.UserId == request.UserId, cancellationToken);

        if (user == null)
            throw new InvalidOperationException($"User {request.UserId} not found.");

        var existingRoles = await _db.UserRoles
            .Where(ur => ur.UserId == user.UserId)
            .ToListAsync(cancellationToken);

        _db.UserRoles.RemoveRange(existingRoles);

        var newRoles = request.RoleIds.Select(roleId => new UserRole
        {
            UserId = user.UserId,
            RoleId = roleId
        }).ToList();

        _db.UserRoles.AddRange(newRoles);
        await _db.SaveChangesAsync(cancellationToken);

        var userRoles = await _db.Roles
            .Where(r => request.RoleIds.Contains(r.RoleId))
            .Select(r => new RoleDto(
                r.RoleId,
                r.Code,
                r.Name,
                r.Description,
                r.IsSystem,
                r.IsActive,
                new List<RightDto>()))
            .ToListAsync(cancellationToken);

        var roleRights = await _db.RoleRights
            .Where(rr => request.RoleIds.Contains(rr.RoleId))
            .ToListAsync(cancellationToken);

        var rightIds = roleRights.Select(rr => rr.RightId).Distinct().ToList();
        var rightCodes = await _db.Rights
            .Where(r => rightIds.Contains(r.RightId))
            .Select(r => r.Code)
            .ToListAsync(cancellationToken);

        return new UserDto(user.UserId, user.TenantId, user.Email, user.FullName, userRoles, rightCodes);
    }
}

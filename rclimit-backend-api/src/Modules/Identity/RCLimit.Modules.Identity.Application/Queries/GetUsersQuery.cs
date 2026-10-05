using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Queries;

public record GetUsersQuery : IRequest<List<UserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
{
    private readonly IIdentityDbContext _db;
    private readonly ITenantContext _tenant;

    public GetUsersQueryHandler(IIdentityDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var users = await _db.Users
            .Where(u => u.TenantId == _tenant.TenantId && u.IsActive)
            .ToListAsync(cancellationToken);

        var userIds = users.Select(u => u.UserId).ToList();
        var userRoles = await _db.UserRoles
            .Where(ur => userIds.Contains(ur.UserId))
            .ToListAsync(cancellationToken);

        var roleIds = userRoles.Select(ur => ur.RoleId).Distinct().ToList();
        var roles = await _db.Roles
            .Where(r => roleIds.Contains(r.RoleId))
            .ToListAsync(cancellationToken);

        var roleRights = await _db.RoleRights
            .Where(rr => roleIds.Contains(rr.RoleId))
            .ToListAsync(cancellationToken);

        var rightIds = roleRights.Select(rr => rr.RightId).Distinct().ToList();
        var rights = await _db.Rights
            .Where(r => rightIds.Contains(r.RightId))
            .ToListAsync(cancellationToken);

        return users.Select(u =>
        {
            var userRoleIds = userRoles
                .Where(ur => ur.UserId == u.UserId)
                .Select(ur => ur.RoleId)
                .ToList();

            var userRoleObjects = roles
                .Where(r => userRoleIds.Contains(r.RoleId))
                .Select(r => new RoleDto(
                    r.RoleId,
                    r.Code,
                    r.Name,
                    r.Description,
                    r.IsSystem,
                    r.IsActive,
                    new List<RightDto>()
                ))
                .ToList();

            var userRightIds = userRoleIds
                .SelectMany(roleId => roleRights.Where(rr => rr.RoleId == roleId).Select(rr => rr.RightId))
                .Distinct()
                .ToList();

            var userRightCodes = rights
                .Where(r => userRightIds.Contains(r.RightId))
                .Select(r => r.Code)
                .ToList();

            return new UserDto(u.UserId, u.TenantId, u.Email, u.FullName, userRoleObjects, userRightCodes);
        }).ToList();
    }
}

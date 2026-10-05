using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Roles;

public record GetRolesQuery : IRequest<List<RoleDto>>;

public class GetRolesQueryHandler : IRequestHandler<GetRolesQuery, List<RoleDto>>
{
    private readonly IIdentityDbContext _db;
    private readonly ITenantContext _tenant;

    public GetRolesQueryHandler(IIdentityDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<RoleDto>> Handle(GetRolesQuery request, CancellationToken cancellationToken)
    {
        var roles = await _db.Roles
            .Where(r => r.TenantId == _tenant.TenantId && r.IsActive)
            .OrderBy(r => r.Name)
            .ToListAsync(cancellationToken);

        var roleIds = roles.Select(r => r.RoleId).ToList();
        var roleRights = await _db.RoleRights
            .Where(rr => roleIds.Contains(rr.RoleId))
            .ToListAsync(cancellationToken);

        var rightIds = roleRights.Select(rr => rr.RightId).Distinct().ToList();
        var allRights = await _db.Rights
            .Where(r => rightIds.Contains(r.RightId))
            .ToListAsync(cancellationToken);

        return roles.Select(role =>
        {
            var roleRightIds = roleRights
                .Where(rr => rr.RoleId == role.RoleId)
                .Select(rr => rr.RightId)
                .ToList();

            var rights = allRights
                .Where(r => roleRightIds.Contains(r.RightId))
                .Select(r => new RightDto(
                    r.RightId,
                    r.Code,
                    r.Module,
                    r.Name,
                    r.Description,
                    r.IsActive
                )).ToList();

            return new RoleDto(
                role.RoleId,
                role.Code,
                role.Name,
                role.Description,
                role.IsSystem,
                role.IsActive,
                rights
            );
        }).ToList();
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Roles;

public record GetRoleQuery(Guid RoleId) : IRequest<RoleDto?>;

public class GetRoleQueryHandler : IRequestHandler<GetRoleQuery, RoleDto?>
{
    private readonly IIdentityDbContext _db;

    public GetRoleQueryHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<RoleDto?> Handle(GetRoleQuery request, CancellationToken cancellationToken)
    {
        var role = await _db.Roles
            .FirstOrDefaultAsync(r => r.RoleId == request.RoleId, cancellationToken);

        if (role == null) return null;

        var roleRightIds = await _db.RoleRights
            .Where(rr => rr.RoleId == role.RoleId)
            .Select(rr => rr.RightId)
            .ToListAsync(cancellationToken);

        var rights = await _db.Rights
            .Where(r => roleRightIds.Contains(r.RightId))
            .Select(r => new RightDto(
                r.RightId,
                r.Code,
                r.Module,
                r.Name,
                r.Description,
                r.IsActive))
            .ToListAsync(cancellationToken);

        return new RoleDto(
            role.RoleId,
            role.Code,
            role.Name,
            role.Description,
            role.IsSystem,
            role.IsActive,
            rights
        );
    }
}

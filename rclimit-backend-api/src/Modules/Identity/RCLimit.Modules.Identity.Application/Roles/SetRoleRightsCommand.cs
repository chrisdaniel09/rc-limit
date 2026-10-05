using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Roles;

public record SetRoleRightsCommand(
    Guid RoleId,
    List<Guid> RightIds) : IRequest<RoleDto>;

public class SetRoleRightsCommandHandler : IRequestHandler<SetRoleRightsCommand, RoleDto>
{
    private readonly IIdentityDbContext _db;

    public SetRoleRightsCommandHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<RoleDto> Handle(SetRoleRightsCommand request, CancellationToken cancellationToken)
    {
        var role = await _db.Roles
            .FirstOrDefaultAsync(r => r.RoleId == request.RoleId, cancellationToken);

        if (role == null)
            throw new InvalidOperationException($"Role {request.RoleId} not found.");

        if (role.IsSystem)
            throw new InvalidOperationException("Cannot modify system roles.");

        var existingRights = await _db.RoleRights
            .Where(rr => rr.RoleId == role.RoleId)
            .ToListAsync(cancellationToken);

        _db.RoleRights.RemoveRange(existingRights);

        var newRights = request.RightIds.Select(rightId => new RoleRight
        {
            RoleId = role.RoleId,
            RightId = rightId
        }).ToList();

        _db.RoleRights.AddRange(newRights);
        await _db.SaveChangesAsync(cancellationToken);

        var rights = await _db.Rights
            .Where(r => request.RightIds.Contains(r.RightId))
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

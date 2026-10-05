using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Roles;

public record UpdateRoleCommand(
    Guid RoleId,
    string Name,
    string? Description,
    bool IsActive) : IRequest<RoleDto>;

public class UpdateRoleCommandHandler : IRequestHandler<UpdateRoleCommand, RoleDto>
{
    private readonly IIdentityDbContext _db;

    public UpdateRoleCommandHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<RoleDto> Handle(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        var role = await _db.Roles
            .FirstOrDefaultAsync(r => r.RoleId == request.RoleId, cancellationToken);

        if (role == null)
            throw new InvalidOperationException($"Role {request.RoleId} not found.");

        if (role.IsSystem)
            throw new InvalidOperationException("Cannot modify system roles.");

        role.Name = request.Name;
        role.Description = request.Description;
        role.IsActive = request.IsActive;

        await _db.SaveChangesAsync(cancellationToken);

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

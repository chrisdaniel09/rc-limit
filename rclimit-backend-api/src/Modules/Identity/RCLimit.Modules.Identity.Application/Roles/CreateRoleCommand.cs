using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Roles;

public record CreateRoleCommand(
    string Code,
    string Name,
    string? Description,
    bool IsSystem = false) : IRequest<RoleDto>;

public class CreateRoleCommandHandler : IRequestHandler<CreateRoleCommand, RoleDto>
{
    private readonly IIdentityDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateRoleCommandHandler(IIdentityDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<RoleDto> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        if (request.IsSystem)
            throw new InvalidOperationException("Cannot create system roles via API.");

        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Code = request.Code,
            Name = request.Name,
            Description = request.Description,
            IsSystem = false,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Roles.Add(role);
        await _db.SaveChangesAsync(cancellationToken);

        return new RoleDto(
            role.RoleId,
            role.Code,
            role.Name,
            role.Description,
            role.IsSystem,
            role.IsActive,
            new List<RightDto>()
        );
    }
}

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
        return await _db.Users
            .Where(u => u.TenantId == _tenant.TenantId && u.IsActive)
            .Select(u => new UserDto(u.UserId, u.TenantId, u.Email, u.FullName))
            .ToListAsync(cancellationToken);
    }
}

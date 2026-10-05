using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Application.Abstractions;

namespace RCLimit.Modules.Identity.Application.Queries;

public record GetUsersLookupQuery : IRequest<List<UserLookupDto>>;

public record UserLookupDto(Guid UserId, string? FullName);

public class GetUsersLookupQueryHandler : IRequestHandler<GetUsersLookupQuery, List<UserLookupDto>>
{
    private readonly IIdentityDbContext _db;
    private readonly ITenantContext _tenant;

    public GetUsersLookupQueryHandler(IIdentityDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<UserLookupDto>> Handle(GetUsersLookupQuery request, CancellationToken cancellationToken)
    {
        var users = await _db.Users
            .Where(u => u.TenantId == _tenant.TenantId && u.IsActive)
            .OrderBy(u => u.FullName)
            .Select(u => new UserLookupDto(u.UserId, u.FullName))
            .ToListAsync(cancellationToken);

        return users;
    }
}

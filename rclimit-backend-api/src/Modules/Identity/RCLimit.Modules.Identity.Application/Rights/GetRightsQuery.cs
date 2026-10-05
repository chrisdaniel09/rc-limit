using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Rights;

public record GetRightsQuery : IRequest<List<RightDto>>;

public class GetRightsQueryHandler : IRequestHandler<GetRightsQuery, List<RightDto>>
{
    private readonly IIdentityDbContext _db;

    public GetRightsQueryHandler(IIdentityDbContext db)
    {
        _db = db;
    }

    public async Task<List<RightDto>> Handle(GetRightsQuery request, CancellationToken cancellationToken)
    {
        return await _db.Rights
            .Where(r => r.IsActive)
            .OrderBy(r => r.Module)
            .ThenBy(r => r.Name)
            .Select(r => new RightDto(
                r.RightId,
                r.Code,
                r.Module,
                r.Name,
                r.Description,
                r.IsActive))
            .ToListAsync(cancellationToken);
    }
}

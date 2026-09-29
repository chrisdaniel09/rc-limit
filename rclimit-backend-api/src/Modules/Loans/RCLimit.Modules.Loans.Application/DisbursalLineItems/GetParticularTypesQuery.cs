using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

public record GetParticularTypesQuery : IRequest<List<DisbursalParticularTypeDto>>;

public class GetParticularTypesQueryHandler(ILoansDbContext db, ITenantContext tenant)
    : IRequestHandler<GetParticularTypesQuery, List<DisbursalParticularTypeDto>>
{
    public async Task<List<DisbursalParticularTypeDto>> Handle(GetParticularTypesQuery request, CancellationToken cancellationToken)
    {
        return await db.DisbursalParticularTypes
            .Where(t => t.TenantId == tenant.TenantId)
            .OrderBy(t => t.SortOrder)
            .Select(t => new DisbursalParticularTypeDto(
                t.ParticularTypeId, t.Code, t.Label, t.SortOrder, t.IsActive))
            .ToListAsync(cancellationToken);
    }
}

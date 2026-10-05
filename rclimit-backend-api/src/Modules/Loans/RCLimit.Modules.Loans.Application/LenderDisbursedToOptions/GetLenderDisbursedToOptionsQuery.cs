using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.LenderDisbursedToOptions;

public record GetLenderDisbursedToOptionsQuery : IRequest<List<LenderDisbursedToOptionDto>>;

public class GetLenderDisbursedToOptionsQueryHandler(ILoansDbContext db, ITenantContext tenant)
    : IRequestHandler<GetLenderDisbursedToOptionsQuery, List<LenderDisbursedToOptionDto>>
{
    public async Task<List<LenderDisbursedToOptionDto>> Handle(GetLenderDisbursedToOptionsQuery request, CancellationToken cancellationToken)
    {
        return await db.LenderDisbursedToOptions
            .Where(o => o.TenantId == tenant.TenantId)
            .OrderBy(o => o.SortOrder)
            .Select(o => new LenderDisbursedToOptionDto(
                o.OptionId, o.Code, o.Label, o.SortOrder, o.IsActive))
            .ToListAsync(cancellationToken);
    }
}

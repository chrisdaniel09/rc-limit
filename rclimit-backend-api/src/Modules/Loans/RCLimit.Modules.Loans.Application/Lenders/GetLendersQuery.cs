using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Lenders;

public record GetLendersQuery : IRequest<List<LenderDto>>;

public class GetLendersQueryHandler : IRequestHandler<GetLendersQuery, List<LenderDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetLendersQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<LenderDto>> Handle(GetLendersQuery request, CancellationToken cancellationToken)
    {
        return await _db.Lenders
            .Where(l => l.TenantId == _tenant.TenantId)
            .Select(l => new LenderDto(
                l.LenderId,
                l.Name,
                l.Code,
                l.BaseInterestRate,
                l.DefaultTenureLimitDays,
                l.Status))
            .ToListAsync(cancellationToken);
    }
}

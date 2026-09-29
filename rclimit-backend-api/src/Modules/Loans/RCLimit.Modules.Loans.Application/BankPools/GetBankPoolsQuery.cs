using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.BankPools;

public record BankPoolDto(
    Guid PoolId,
    Guid LenderId,
    string LenderName,
    string FacilityAccountNumber,
    decimal SanctionedLimit,
    decimal UtilizedAmount,
    string Status);

public record GetBankPoolsQuery : IRequest<List<BankPoolDto>>;

public class GetBankPoolsQueryHandler : IRequestHandler<GetBankPoolsQuery, List<BankPoolDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetBankPoolsQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<BankPoolDto>> Handle(GetBankPoolsQuery request, CancellationToken cancellationToken)
    {
        return await _db.MasterBankPools
            .Where(p => p.TenantId == _tenant.TenantId && p.Status == "ACTIVE")
            .Include(p => p.Lender)
            .Select(p => new BankPoolDto(
                p.PoolId,
                p.LenderId,
                p.Lender.Name,
                p.FacilityAccountNumber,
                p.SanctionedLimit,
                p.UtilizedAmount,
                p.Status))
            .ToListAsync(cancellationToken);
    }
}

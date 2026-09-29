using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Loans;

public record GetLoansQuery : IRequest<List<LoanDto>>;

public class GetLoansQueryHandler : IRequestHandler<GetLoansQuery, List<LoanDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetLoansQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<LoanDto>> Handle(GetLoansQuery request, CancellationToken cancellationToken)
    {
        return await _db.LoanTransactions
            .Where(l => l.TenantId == _tenant.TenantId)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Include(l => l.Pool).ThenInclude(p => p.Lender)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LoanDto(
                l.LoanId,
                l.LoanNumber,
                l.Customer.LegalName,
                l.Vehicle.RegistrationNumber,
                l.Pool.Lender.Name,
                l.ProductType,
                l.SanctionedAmount,
                l.NetDisbursedAmount,
                l.CustomerRate,
                l.TotalPayoutEarned,
                l.LoanStatus,
                l.DisbursalDate))
            .ToListAsync(cancellationToken);
    }
}

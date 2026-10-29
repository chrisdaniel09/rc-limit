using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Loans;

public record GetLoanDetailQuery(Guid LoanId) : IRequest<LoanDetailDto?>;

public class GetLoanDetailQueryHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<GetLoanDetailQuery, LoanDetailDto?>
{
    public async Task<LoanDetailDto?> Handle(GetLoanDetailQuery request, CancellationToken cancellationToken)
    {
        var loan = await db.LoanTransactions
            .Where(l => l.LoanId == request.LoanId && l.TenantId == tenant.TenantId)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Include(l => l.Pool).ThenInclude(p => p.Lender)
            .Include(l => l.DisbursalLineItems)
            .Include(l => l.RcTracker)
            .Include(l => l.DocumentStatus)
            .FirstOrDefaultAsync(cancellationToken);

        return loan is null ? null : LoanDetailMapper.ToDetail(loan);
    }
}

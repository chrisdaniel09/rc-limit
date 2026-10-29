using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Loans;

public static class LoanQueries
{
    // Loads a tenant's loan with everything the detail view needs. The row carries its version,
    // so a concurrent change is reported as a conflict when the write is saved.
    public static async Task<LoanTransaction> LoadDetailedAsync(
        ILoansDbContext db, Guid tenantId, Guid loanId, CancellationToken cancellationToken)
    {
        return await db.LoanTransactions
            .Where(l => l.LoanId == loanId && l.TenantId == tenantId)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Include(l => l.Pool).ThenInclude(p => p.Lender)
            .Include(l => l.DisbursalLineItems)
            .Include(l => l.RcTracker)
            .Include(l => l.DocumentStatus)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Loan", loanId);
    }
}

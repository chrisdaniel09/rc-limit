using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Loans.Contracts;
using RCLimit.Modules.Loans.Contracts.Dtos;
using RCLimit.Modules.Loans.Infrastructure.Persistence;

namespace RCLimit.Modules.Loans.Infrastructure;

public class LoansModuleApi : ILoansModuleApi
{
    private readonly LoansDbContext _db;

    public LoansModuleApi(LoansDbContext db)
    {
        _db = db;
    }

    public async Task<LoanSummaryDto?> GetLoanByIdAsync(Guid loanId)
    {
        return await _db.LoanTransactions
            .Where(l => l.LoanId == loanId)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Select(l => new LoanSummaryDto(
                l.LoanId,
                l.Customer.LegalName,
                l.Vehicle.RegistrationNumber,
                l.SanctionedAmount,
                l.LoanStatus))
            .FirstOrDefaultAsync();
    }

    public async Task<int> GetPendingRcCountAsync(Guid customerId)
    {
        var subLimit = await _db.CustomerSubLimits
            .FirstOrDefaultAsync(s => s.CustomerId == customerId);
        return subLimit?.PendingRcCount ?? 0;
    }
}

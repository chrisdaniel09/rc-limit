using RCLimit.Modules.Loans.Contracts.Dtos;

namespace RCLimit.Modules.Loans.Contracts;

public interface ILoansModuleApi
{
    Task<LoanSummaryDto?> GetLoanByIdAsync(Guid loanId);
    Task<int> GetPendingRcCountAsync(Guid customerId);
}

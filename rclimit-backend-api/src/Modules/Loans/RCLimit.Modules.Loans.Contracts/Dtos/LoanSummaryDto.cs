namespace RCLimit.Modules.Loans.Contracts.Dtos;

public record LoanSummaryDto(
    Guid LoanId,
    string CustomerName,
    string VehicleRegNo,
    decimal SanctionedAmount,
    string LoanStatus);

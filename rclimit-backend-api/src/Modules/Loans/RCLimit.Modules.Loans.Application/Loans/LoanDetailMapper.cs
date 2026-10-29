using RCLimit.Modules.Loans.Application.DisbursalLineItems;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// Builds the detail view of a loan. The loan must have Customer, Vehicle, Pool.Lender, DisbursalLineItems,
// RcTracker and DocumentStatus loaded.
public static class LoanDetailMapper
{
    public static LoanDetailDto ToDetail(LoanTransaction loan)
    {
        var agingDays = loan.LoanStatus == LoanStatuses.Disbursed && loan.DisbursalDate is { } disbursed
            ? DateOnly.FromDateTime(DateTime.UtcNow).DayNumber - disbursed.DayNumber
            : (int?)null;

        var entries = loan.DisbursalLineItems
            .OrderBy(li => li.CreatedAt)
            .ThenBy(li => li.LineItemId)
            .Select(li => new DisbursalLineItemDto(
                li.LineItemId,
                li.LoanId,
                li.EntryDate,
                li.EntryDirection,
                li.Counterparty,
                li.ParticularType,
                li.ModeOfPayment,
                li.BankName,
                li.AccountNo,
                li.TransactionId,
                li.Amount,
                li.RunningBalanceAmt))
            .ToList();

        return new LoanDetailDto(
            loan.LoanId,
            loan.ApplicationNumber,
            loan.LenderAgreementNumber,
            loan.CustomerId,
            loan.Customer.LegalName,
            loan.VehicleId,
            loan.Vehicle.RegistrationNumber,
            loan.Pool.Lender.Name,
            loan.PoolId,
            loan.PartnerId,
            loan.ProductType,
            loan.RequestedAmount,
            loan.SanctionedAmount,
            loan.NetDisbursedAmount,
            loan.CustomerRate,
            loan.TenureMonths,
            loan.BankPayoutPctAmt,
            loan.BonusPayoutAmt,
            loan.SharedPayoutAmt,
            loan.TotalPayoutEarned,
            loan.LoanStatus,
            LoanStatuses.NextStatuses(loan.LoanStatus),
            loan.LoggedInDate,
            loan.SanctionDate,
            loan.DisbursalDate,
            loan.EmiStartDate,
            loan.EmiDueDay,
            loan.PddDueDate,
            loan.ClosedDate,
            loan.RejectionWithdrawnDate,
            loan.RejectionWithdrawnReason,
            loan.Remarks,
            loan.RcTracker?.CurrentStage,
            loan.RcTracker?.AgingStatus,
            agingDays,
            loan.PostDisbursementDocumentStatusId,
            loan.DocumentStatus?.Label,
            entries);
    }
}

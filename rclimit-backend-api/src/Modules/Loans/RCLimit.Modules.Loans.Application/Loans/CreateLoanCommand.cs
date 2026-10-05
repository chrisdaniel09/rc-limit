using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Accounting.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Loans;

public record CreateLoanCommand(
    Guid CustomerId,
    Guid VehicleId,
    Guid PoolId,
    Guid? PartnerId,
    string? LenderAgreementNumber,
    string ProductType,
    decimal SanctionedAmount,
    decimal LenderDisbursedAmount,
    string LenderDisbursedTo,
    decimal CustomerRate,
    decimal BankPayoutPctAmt,
    decimal BonusPayoutAmt,
    decimal SharedPayoutAmt,
    string? Remarks) : IRequest<Guid>;

public class CreateLoanCommandHandler(
    ILoansDbContext db,
    ITenantContext tenant,
    IAccountingModuleApi accounting) : IRequestHandler<CreateLoanCommand, Guid>
{
    public async Task<Guid> Handle(CreateLoanCommand request, CancellationToken cancellationToken)
    {
        var subLimit = await db.CustomerSubLimits
            .FirstOrDefaultAsync(s => s.CustomerId == request.CustomerId, cancellationToken);

        if (subLimit is not null && subLimit.StopSupplyFlag)
            throw new InvalidOperationException("Stop-supply is active for this dealer. No new disbursals allowed.");

        if (subLimit is not null && subLimit.CurrentUtilization + request.SanctionedAmount > subLimit.AssignedCeiling)
            throw new InvalidOperationException("Loan amount exceeds available sub-limit.");

        var loanId = Guid.NewGuid();
        var loan = new LoanTransaction
        {
            LoanId = loanId,
            TenantId = tenant.TenantId,
            LoanNumber = $"LN-{DateTime.UtcNow:yyyy}-{Random.Shared.Next(1000, 9999)}",
            LenderAgreementNumber = request.LenderAgreementNumber,
            CustomerId = request.CustomerId,
            VehicleId = request.VehicleId,
            PoolId = request.PoolId,
            PartnerId = request.PartnerId,
            ProductType = request.ProductType,
            SanctionedAmount = request.SanctionedAmount,
            LenderDisbursedAmount = request.LenderDisbursedAmount,
            LenderDisbursedTo = request.LenderDisbursedTo,
            NetDisbursedAmount = 0,
            CustomerRate = request.CustomerRate,
            BankPayoutPctAmt = request.BankPayoutPctAmt,
            BonusPayoutAmt = request.BonusPayoutAmt,
            SharedPayoutAmt = request.SharedPayoutAmt,
            Remarks = request.Remarks
        };

        var tracker = new RcPipelineTracker
        {
            TrackerId = Guid.NewGuid(),
            LoanId = loanId
        };

        db.LoanTransactions.Add(loan);
        db.RcPipelineTrackers.Add(tracker);

        if (subLimit is not null)
        {
            subLimit.CurrentUtilization += request.SanctionedAmount;
            subLimit.PendingRcCount += 1;
            subLimit.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(cancellationToken);

        await accounting.PostDisbursalEntryAsync(new DisbursalPostingRequest(
            tenant.TenantId,
            loan.LoanId,
            "BANK_DISBURSAL",
            loan.SanctionedAmount,
            $"Loan disbursal {loan.LoanNumber} — Sanctioned {loan.SanctionedAmount:N2}",
            tenant.UserId));

        return loanId;
    }
}

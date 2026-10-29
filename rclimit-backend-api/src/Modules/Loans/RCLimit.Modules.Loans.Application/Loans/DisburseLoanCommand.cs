using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// Moves a loan from SANCTIONED to DISBURSED. Records the status change only. The first bank credit is entered
// afterwards as a ledger entry (decision C3). The sub-limit is utilized here, and the PDD due date comes from
// the lender's SLA (decision D4).
public record DisburseLoanCommand(
    Guid LoanId,
    DateOnly DisbursalDate,
    DateOnly EmiStartDate,
    int EmiDueDay) : IRequest<LoanDetailDto>;

public class DisburseLoanCommandHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<DisburseLoanCommand, LoanDetailDto>
{
    public async Task<LoanDetailDto> Handle(DisburseLoanCommand request, CancellationToken cancellationToken)
    {
        if (request.EmiDueDay is < 1 or > 31)
            throw new ValidationException("EMI due day must be between 1 and 31.");

        var loan = await LoanQueries.LoadDetailedAsync(db, tenant.TenantId, request.LoanId, cancellationToken);

        if (!LoanStatuses.CanMove(loan.LoanStatus, LoanStatuses.Disbursed))
            throw new BusinessRuleException(
                $"A loan in {loan.LoanStatus} cannot be disbursed.", "INVALID_STATUS_TRANSITION");

        var sanctioned = loan.SanctionedAmount
            ?? throw new BusinessRuleException("The loan has no sanctioned amount.", "SANCTION_MISSING");

        if (loan.ProductType == "USED_CV")
        {
            var subLimit = await db.CustomerSubLimits.FirstOrDefaultAsync(s => s.CustomerId == loan.CustomerId, cancellationToken)
                ?? throw new BusinessRuleException("The customer has no sub-limit configured.", "SUB_LIMIT_MISSING");

            // Headroom is checked again here: other loans may have used it since this one was sanctioned.
            var violation = SubLimitRules.HeadroomViolation(subLimit, sanctioned);
            if (violation is not null)
                throw new BusinessRuleException(violation, "SUB_LIMIT_EXCEEDED");

            subLimit.CurrentUtilization += sanctioned;
            subLimit.PendingRcCount += 1;
            subLimit.UpdatedAt = DateTime.UtcNow;

            // The RC aging clock applies to used vehicles only.
            if (loan.RcTracker is null)
            {
                loan.RcTracker = new RcPipelineTracker { TrackerId = Guid.NewGuid(), LoanId = loan.LoanId };
                db.RcPipelineTrackers.Add(loan.RcTracker);
            }
        }

        loan.DisbursalDate = request.DisbursalDate;
        loan.EmiStartDate = request.EmiStartDate;
        loan.EmiDueDay = request.EmiDueDay;
        loan.PddDueDate = request.DisbursalDate.AddDays(loan.Pool.Lender.PddSlaDays);
        loan.LoanStatus = LoanStatuses.Disbursed;
        loan.UpdatedAt = DateTime.UtcNow;

        await db.SaveAsync(cancellationToken);

        return LoanDetailMapper.ToDetail(loan);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// Moves a loan between the stages that carry no data of their own. Sanction and disbursal have their own commands.
// Closing a disbursed loan restores its sub-limit utilization and pending-RC count (gap L19).
public record ChangeLoanStatusCommand(Guid LoanId, string TargetStatus, string? Reason) : IRequest<LoanDetailDto>;

public class ChangeLoanStatusCommandHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<ChangeLoanStatusCommand, LoanDetailDto>
{
    public async Task<LoanDetailDto> Handle(ChangeLoanStatusCommand request, CancellationToken cancellationToken)
    {
        if (LoanStatuses.RequiresDedicatedEndpoint(request.TargetStatus))
            throw new BusinessRuleException(
                $"Use the {request.TargetStatus.ToLowerInvariant()} action for this stage.", "USE_DEDICATED_ACTION");

        var loan = await LoanQueries.LoadDetailedAsync(db, tenant.TenantId, request.LoanId, cancellationToken);

        if (!LoanStatuses.CanMove(loan.LoanStatus, request.TargetStatus))
            throw new BusinessRuleException(
                $"A loan in {loan.LoanStatus} cannot move to {request.TargetStatus}.", "INVALID_STATUS_TRANSITION");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        switch (request.TargetStatus)
        {
            case LoanStatuses.LoggedIn:
                loan.LoggedInDate = today;
                break;

            case LoanStatuses.Rejected:
            case LoanStatuses.Withdrawn:
                if (string.IsNullOrWhiteSpace(request.Reason))
                    throw new ValidationException("A reason is required to reject or withdraw a loan.");
                loan.RejectionWithdrawnDate = today;
                loan.RejectionWithdrawnReason = request.Reason.Trim();
                break;

            case LoanStatuses.Closed:
                loan.ClosedDate = today;
                await RestoreSubLimitAsync(loan, cancellationToken);
                break;
        }

        loan.LoanStatus = request.TargetStatus;
        loan.UpdatedAt = DateTime.UtcNow;

        await db.SaveAsync(cancellationToken);

        return LoanDetailMapper.ToDetail(loan);
    }

    private async Task RestoreSubLimitAsync(LoanTransaction loan, CancellationToken cancellationToken)
    {
        if (loan.ProductType != "USED_CV" || loan.SanctionedAmount is null)
            return;

        var subLimit = await db.CustomerSubLimits.FirstOrDefaultAsync(s => s.CustomerId == loan.CustomerId, cancellationToken);
        if (subLimit is null)
            return;

        subLimit.CurrentUtilization = Math.Max(0, subLimit.CurrentUtilization - loan.SanctionedAmount.Value);
        subLimit.PendingRcCount = Math.Max(0, subLimit.PendingRcCount - 1);
        subLimit.UpdatedAt = DateTime.UtcNow;
    }
}

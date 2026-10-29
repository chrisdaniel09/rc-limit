using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// Moves a loan from CREDIT_REVIEW to SANCTIONED and captures the sanctioned amount (spec section 3).
public record SanctionLoanCommand(
    Guid LoanId,
    decimal SanctionedAmount,
    int TenureMonths,
    decimal CustomerRate,
    DateOnly SanctionDate) : IRequest<LoanDetailDto>;

public class SanctionLoanCommandHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<SanctionLoanCommand, LoanDetailDto>
{
    public async Task<LoanDetailDto> Handle(SanctionLoanCommand request, CancellationToken cancellationToken)
    {
        if (request.SanctionedAmount <= 0)
            throw new ValidationException("Sanctioned amount must be greater than zero.");

        if (request.TenureMonths <= 0)
            throw new ValidationException("Tenure must be at least one month.");

        if (request.CustomerRate < 0)
            throw new ValidationException("Customer rate cannot be negative.");

        var loan = await LoanQueries.LoadDetailedAsync(db, tenant.TenantId, request.LoanId, cancellationToken);

        if (!LoanStatuses.CanMove(loan.LoanStatus, LoanStatuses.Sanctioned))
            throw new BusinessRuleException(
                $"A loan in {loan.LoanStatus} cannot be sanctioned.", "INVALID_STATUS_TRANSITION");

        if (loan.ProductType == "USED_CV")
        {
            var subLimit = await db.CustomerSubLimits.FirstOrDefaultAsync(s => s.CustomerId == loan.CustomerId, cancellationToken)
                ?? throw new BusinessRuleException("The customer has no sub-limit configured.", "SUB_LIMIT_MISSING");

            var violation = SubLimitRules.HeadroomViolation(subLimit, request.SanctionedAmount);
            if (violation is not null)
                throw new BusinessRuleException(violation, "SUB_LIMIT_EXCEEDED");
        }

        loan.SanctionedAmount = request.SanctionedAmount;
        loan.TenureMonths = request.TenureMonths;
        loan.CustomerRate = request.CustomerRate;
        loan.SanctionDate = request.SanctionDate;
        loan.LoanStatus = LoanStatuses.Sanctioned;
        loan.UpdatedAt = DateTime.UtcNow;

        await db.SaveAsync(cancellationToken);

        return LoanDetailMapper.ToDetail(loan);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Loans;

public record UpdateLoanDocumentStatusCommand(Guid LoanId, Guid? DocumentStatusId) : IRequest<LoanDetailDto>;

public class UpdateLoanDocumentStatusCommandHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<UpdateLoanDocumentStatusCommand, LoanDetailDto>
{
    public async Task<LoanDetailDto> Handle(UpdateLoanDocumentStatusCommand request, CancellationToken cancellationToken)
    {
        // The referenced status must exist, belong to this tenant and be active (gap L31).
        if (request.DocumentStatusId is { } statusId)
        {
            var statusActive = await db.PostDisbursementDocumentStatuses.AnyAsync(
                s => s.DocumentStatusId == statusId && s.TenantId == tenant.TenantId && s.IsActive, cancellationToken);
            if (!statusActive)
                throw new ValidationException("The document status is not an active status for this tenant.");
        }

        var loan = await LoanQueries.LoadDetailedAsync(db, tenant.TenantId, request.LoanId, cancellationToken);

        loan.PostDisbursementDocumentStatusId = request.DocumentStatusId;
        loan.UpdatedAt = DateTime.UtcNow;

        await db.SaveAsync(cancellationToken);

        return LoanDetailMapper.ToDetail(loan);
    }
}

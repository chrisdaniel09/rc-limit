using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Application.DisbursalLineItems;

namespace RCLimit.Modules.Loans.Application.Loans;

public record UpdateLoanDocumentStatusCommand(Guid LoanId, Guid? DocumentStatusId) : IRequest<LoanDetailDto?>;

public class UpdateLoanDocumentStatusCommandHandler : IRequestHandler<UpdateLoanDocumentStatusCommand, LoanDetailDto?>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public UpdateLoanDocumentStatusCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<LoanDetailDto?> Handle(UpdateLoanDocumentStatusCommand request, CancellationToken cancellationToken)
    {
        var loan = await _db.LoanTransactions
            .Where(l => l.LoanId == request.LoanId && l.TenantId == _tenant.TenantId)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Include(l => l.Pool).ThenInclude(p => p.Lender)
            .Include(l => l.DisbursalLineItems)
            .Include(l => l.RcTracker)
            .Include(l => l.DocumentStatus)
            .FirstOrDefaultAsync(cancellationToken);

        if (loan is null) return null;

        loan.PostDisbursementDocumentStatusId = request.DocumentStatusId;
        loan.UpdatedAt = DateTime.UtcNow;

        _db.LoanTransactions.Update(loan);
        await _db.SaveChangesAsync(cancellationToken);

        var lenderOption = await _db.LenderDisbursedToOptions
            .FirstOrDefaultAsync(o => o.Code == loan.LenderDisbursedTo && o.IsActive, cancellationToken);

        var isDisbursalEnabled = lenderOption?.AllowsDisbursalLineItems ?? false;

        var agingDays = loan.LoanStatus == "DISBURSED_RC_PENDING"
            ? DateOnly.FromDateTime(DateTime.UtcNow).DayNumber - loan.DisbursalDate.DayNumber
            : (int?)null;

        return new LoanDetailDto(
            loan.LoanId,
            loan.LoanNumber,
            loan.LenderAgreementNumber,
            loan.CustomerId,
            loan.Customer.LegalName,
            loan.VehicleId,
            loan.Vehicle.RegistrationNumber,
            loan.Pool.Lender.Name,
            loan.PoolId,
            loan.PartnerId,
            loan.ProductType,
            loan.SanctionedAmount,
            loan.LenderDisbursedAmount,
            loan.LenderDisbursedTo,
            loan.NetDisbursedAmount,
            loan.CustomerRate,
            loan.BankPayoutPctAmt,
            loan.BonusPayoutAmt,
            loan.SharedPayoutAmt,
            loan.TotalPayoutEarned,
            loan.LoanStatus,
            loan.DisbursalDate,
            loan.Remarks,
            loan.RcTracker?.CurrentStage,
            loan.RcTracker?.AgingStatus,
            agingDays,
            loan.PostDisbursementDocumentStatusId,
            loan.DocumentStatus?.Label,
            isDisbursalEnabled,
            loan.DisbursalLineItems
                .OrderBy(li => li.EntryDate)
                .Select(li => new DisbursalLineItemDto(
                    li.LineItemId,
                    li.LoanId,
                    li.EntryDate,
                    li.ParticularType,
                    li.ModeOfPayment,
                    li.BankName,
                    li.AccountNo,
                    li.TransactionId,
                    li.DebitAmount,
                    li.RunningBalanceAmt))
                .ToList());
    }
}

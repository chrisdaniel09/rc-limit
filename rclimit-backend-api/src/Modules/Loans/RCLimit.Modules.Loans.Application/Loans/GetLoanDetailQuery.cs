using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Application.DisbursalLineItems;

namespace RCLimit.Modules.Loans.Application.Loans;

public record GetLoanDetailQuery(Guid LoanId) : IRequest<LoanDetailDto?>;

public class GetLoanDetailQueryHandler : IRequestHandler<GetLoanDetailQuery, LoanDetailDto?>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetLoanDetailQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<LoanDetailDto?> Handle(GetLoanDetailQuery request, CancellationToken cancellationToken)
    {
        var loan = await _db.LoanTransactions
            .Where(l => l.LoanId == request.LoanId && l.TenantId == _tenant.TenantId)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Include(l => l.Pool).ThenInclude(p => p.Lender)
            .Include(l => l.DisbursalLineItems)
            .Include(l => l.RcTracker)
            .FirstOrDefaultAsync(cancellationToken);

        if (loan is null) return null;

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

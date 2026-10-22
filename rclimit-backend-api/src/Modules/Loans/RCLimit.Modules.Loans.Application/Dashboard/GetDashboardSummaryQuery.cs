using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Dashboard;

public record DashboardSummaryDto(
    int TotalLoans,
    int ActiveLoans,
    decimal TotalSanctioned,
    int PendingRcCount,
    int StopSupplyDealers);

public record GetDashboardSummaryQuery : IRequest<DashboardSummaryDto>;

public class GetDashboardSummaryQueryHandler : IRequestHandler<GetDashboardSummaryQuery, DashboardSummaryDto>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetDashboardSummaryQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<DashboardSummaryDto> Handle(GetDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId;

        var totalLoans = await _db.LoanTransactions
            .CountAsync(l => l.TenantId == tenantId, cancellationToken);

        var activeLoans = await _db.LoanTransactions
            .CountAsync(l => l.TenantId == tenantId && l.LoanStatus == "DISBURSED_RC_PENDING", cancellationToken);

        var totalSanctioned = await _db.LoanTransactions
            .Where(l => l.TenantId == tenantId)
            .SumAsync(l => l.SanctionedAmount, cancellationToken);

        var pendingRcCount = await _db.RcPipelineTrackers
            .CountAsync(t => t.LoanTransaction.TenantId == tenantId
                && t.CurrentStage != "BANK_VERIFIED_CLEARED", cancellationToken);

        var stopSupplyDealers = await _db.CustomerSubLimits
            .CountAsync(s => s.Customer.TenantId == tenantId && s.StopSupplyFlag, cancellationToken);

        return new DashboardSummaryDto(totalLoans, activeLoans, totalSanctioned, pendingRcCount, stopSupplyDealers);
    }
}

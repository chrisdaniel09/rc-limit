using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Dashboard;

public record DashboardDto(
    int TotalLoans,
    int ActiveLoans,
    decimal TotalSanctioned,
    int PendingRcCount,
    int StopSupplyDealers,
    List<RcAgingAlertDto> RcAgingAlerts);

public record RcAgingAlertDto(
    Guid LoanId,
    string? LoanNumber,
    string CustomerName,
    string VehicleRegNo,
    int AgingDays,
    string AgingStatus);

public record GetDashboardQuery : IRequest<DashboardDto>;

public class GetDashboardQueryHandler : IRequestHandler<GetDashboardQuery, DashboardDto>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetDashboardQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<DashboardDto> Handle(GetDashboardQuery request, CancellationToken cancellationToken)
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

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rcAgingAlerts = await _db.LoanTransactions
            .Where(l => l.TenantId == tenantId && l.LoanStatus == "DISBURSED_RC_PENDING")
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Select(l => new
            {
                l.LoanId,
                l.LoanNumber,
                CustomerName = l.Customer.LegalName,
                VehicleRegNo = l.Vehicle.RegistrationNumber,
                l.DisbursalDate
            })
            .ToListAsync(cancellationToken);

        var alerts = rcAgingAlerts
            .Select(l =>
            {
                var agingDays = today.DayNumber - l.DisbursalDate.DayNumber;
                var status = agingDays switch
                {
                    <= 30 => "ON_TIME",
                    <= 44 => "WARNING_ZONE",
                    _ => "OVERDUE_LOCK"
                };
                return new RcAgingAlertDto(l.LoanId, l.LoanNumber, l.CustomerName, l.VehicleRegNo, agingDays, status);
            })
            .Where(a => a.AgingDays > 15)
            .OrderByDescending(a => a.AgingDays)
            .ToList();

        return new DashboardDto(totalLoans, activeLoans, totalSanctioned, pendingRcCount, stopSupplyDealers, alerts);
    }
}

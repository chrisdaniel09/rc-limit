using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Dashboard;

public record RcAgingAlertDto(
    Guid LoanId,
    string? LoanNumber,
    string CustomerName,
    string VehicleRegNo,
    int AgingDays,
    string AgingStatus);

public record GetRcAgingAlertsQuery : IRequest<List<RcAgingAlertDto>>;

public class GetRcAgingAlertsQueryHandler : IRequestHandler<GetRcAgingAlertsQuery, List<RcAgingAlertDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetRcAgingAlertsQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<RcAgingAlertDto>> Handle(GetRcAgingAlertsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var pending = await _db.LoanTransactions
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

        return pending
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
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Dashboard;

public record RcAgingAlertDto(
    Guid LoanId,
    string ApplicationNumber,
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

        // The RC clock runs from disbursal until the loan is closed.
        var pending = await _db.LoanTransactions
            .Where(l => l.TenantId == tenantId && l.LoanStatus == LoanStatuses.Disbursed && l.DisbursalDate != null)
            .Include(l => l.Customer)
            .Include(l => l.Vehicle)
            .Select(l => new
            {
                l.LoanId,
                l.ApplicationNumber,
                CustomerName = l.Customer.LegalName,
                VehicleRegNo = l.Vehicle.RegistrationNumber,
                DisbursalDate = l.DisbursalDate!.Value
            })
            .ToListAsync(cancellationToken);

        return pending
            .Select(l =>
            {
                var agingDays = RcAgingRules.AgingDays(l.DisbursalDate, today);
                var status = RcAgingRules.Status(agingDays);
                return new RcAgingAlertDto(l.LoanId, l.ApplicationNumber, l.CustomerName, l.VehicleRegNo, agingDays, status);
            })
            .Where(a => a.AgingDays > 15)
            .OrderByDescending(a => a.AgingDays)
            .ToList();
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Dashboard;

public record MyDashboardDto(
    int TotalAssigned,
    int OpenLeads,
    int ConvertedLeads,
    List<LeadStatusCountDto> ByStatus);

public record LeadStatusCountDto(string Status, int Count);

public record GetMyDashboardQuery : IRequest<MyDashboardDto>;

public class GetMyDashboardQueryHandler : IRequestHandler<GetMyDashboardQuery, MyDashboardDto>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetMyDashboardQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<MyDashboardDto> Handle(GetMyDashboardQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId;
        var userId = _tenant.UserId;

        var byStatus = await _db.Leads
            .Where(l => l.TenantId == tenantId && l.AssignedToUserId == userId)
            .GroupBy(l => l.LeadStatus)
            .Select(g => new LeadStatusCountDto(g.Key, g.Count()))
            .OrderBy(s => s.Status)
            .ToListAsync(cancellationToken);

        var totalAssigned = byStatus.Sum(s => s.Count);
        var converted = byStatus
            .Where(s => s.Status == "CONVERTED")
            .Sum(s => s.Count);

        return new MyDashboardDto(totalAssigned, totalAssigned - converted, converted, byStatus);
    }
}

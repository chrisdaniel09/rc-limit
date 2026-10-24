using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Leads.Application.Abstractions;

namespace RCLimit.Modules.Leads.Application.Dashboard;

public record MyDashboardDto(
    int TotalAssigned,
    int OpenLeads,
    int ConvertedLeads,
    List<LeadStatusCountDto> ByStatus);

public record LeadStatusCountDto(string Status, int Count);

public record GetMyDashboardQuery : IRequest<MyDashboardDto>;

public class GetMyDashboardQueryHandler : IRequestHandler<GetMyDashboardQuery, MyDashboardDto>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;

    public GetMyDashboardQueryHandler(ILeadsDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<MyDashboardDto> Handle(GetMyDashboardQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenant.TenantId;
        var userId = _tenant.UserId;

        // Group in the database with an anonymous projection, then map to the DTO in memory.
        // Projecting straight into a record constructor inside GroupBy is not translatable by EF Core.
        var counts = await _db.Leads
            .Where(l => l.TenantId == tenantId && l.AssignedToUserId == userId)
            .GroupBy(l => l.LeadStatus)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var byStatus = counts
            .OrderBy(c => c.Status)
            .Select(c => new LeadStatusCountDto(c.Status, c.Count))
            .ToList();

        var totalAssigned = byStatus.Sum(s => s.Count);
        var converted = byStatus
            .Where(s => s.Status == "CONVERTED")
            .Sum(s => s.Count);

        return new MyDashboardDto(totalAssigned, totalAssigned - converted, converted, byStatus);
    }
}

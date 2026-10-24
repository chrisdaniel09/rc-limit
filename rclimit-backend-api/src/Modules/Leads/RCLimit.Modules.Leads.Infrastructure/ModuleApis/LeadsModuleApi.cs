using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Contracts;

namespace RCLimit.Modules.Leads.Infrastructure.ModuleApis;

public sealed class LeadsModuleApi(ILeadsDbContext db, ITenantContext tenant) : ILeadsModuleApi
{

    public async Task<IReadOnlyList<CustomerLeadLinkDto>> GetLeadsForCustomerAsync(
        Guid customerId,
        CancellationToken cancellationToken = default)
    {
        return await (
            from link in db.LeadCustomers.AsNoTracking()
            join lead in db.Leads.AsNoTracking() on link.LeadId equals lead.LeadId
            where link.TenantId == tenant.TenantId && link.CustomerId == customerId
            orderby link.LinkedAt descending
            select new CustomerLeadLinkDto(
                lead.LeadId,
                lead.ApplicantName,
                lead.LeadSource,
                lead.LeadStatus,
                lead.CreatedAt,
                link.LinkedAt,
                lead.VehicleRegistrationNumber))
            .ToListAsync(cancellationToken);
    }
}

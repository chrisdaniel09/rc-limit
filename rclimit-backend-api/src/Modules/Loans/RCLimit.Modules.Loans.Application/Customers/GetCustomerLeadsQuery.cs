using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Customers;

public record GetCustomerLeadsQuery(Guid CustomerId) : IRequest<List<CustomerLeadDto>>;

public record CustomerLeadDto(
    Guid LeadId,
    string ApplicantName,
    string LeadSource,
    string LeadStatus,
    DateTime CreatedAt,
    DateTime? ConvertedAt,
    string? VehicleRegistrationNumber,
    string? VehicleAction); // CURRENT | TRANSFERRED | SOLD

public class GetCustomerLeadsQueryHandler : IRequestHandler<GetCustomerLeadsQuery, List<CustomerLeadDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetCustomerLeadsQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<CustomerLeadDto>> Handle(GetCustomerLeadsQuery request, CancellationToken cancellationToken)
    {
        var leads = await _db.LeadCustomers
            .AsNoTracking()
            .Where(lc => lc.TenantId == _tenant.TenantId && lc.CustomerId == request.CustomerId)
            .Include(lc => new { })
            .OrderByDescending(lc => lc.LinkedAt)
            .ToListAsync(cancellationToken);

        var result = new List<CustomerLeadDto>();

        foreach (var leadCustomer in leads)
        {
            var lead = await _db.Leads
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.LeadId == leadCustomer.LeadId, cancellationToken);

            if (lead == null) continue;

            // Get vehicle info from customer_vehicles if this lead was the source
            var vehicleInfo = await _db.CustomerVehicles
                .AsNoTracking()
                .FirstOrDefaultAsync(cv => cv.SourceLeadId == leadCustomer.LeadId, cancellationToken);

            var vehicleReg = lead.VehicleRegistrationNumber;
            string? vehicleAction = null;

            if (vehicleInfo != null)
            {
                vehicleAction = vehicleInfo.OwnedTo == null ? "CURRENT" : vehicleInfo.EndReason;
            }

            result.Add(new CustomerLeadDto(
                lead.LeadId,
                lead.ApplicantName ?? "Unknown",
                lead.LeadSource,
                lead.LeadStatus,
                lead.CreatedAt,
                leadCustomer.LinkedAt,
                vehicleReg,
                vehicleAction));
        }

        return result;
    }
}

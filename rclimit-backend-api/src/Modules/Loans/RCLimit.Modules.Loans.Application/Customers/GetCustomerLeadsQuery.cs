using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Leads.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

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
    private readonly ILeadsModuleApi _leads;

    public GetCustomerLeadsQueryHandler(ILoansDbContext db, ILeadsModuleApi leads)
    {
        _db = db;
        _leads = leads;
    }

    public async Task<List<CustomerLeadDto>> Handle(GetCustomerLeadsQuery request, CancellationToken cancellationToken)
    {
        var links = await _leads.GetLeadsForCustomerAsync(request.CustomerId, cancellationToken);

        var result = new List<CustomerLeadDto>();

        foreach (var link in links)
        {
            // Vehicle action comes from the ownership history, which belongs to the Loans module.
            var vehicleInfo = await _db.CustomerVehicles
                .AsNoTracking()
                .FirstOrDefaultAsync(cv => cv.SourceLeadId == link.LeadId, cancellationToken);

            string? vehicleAction = null;
            if (vehicleInfo != null)
            {
                vehicleAction = vehicleInfo.OwnedTo == null ? "CURRENT" : vehicleInfo.EndReason;
            }

            result.Add(new CustomerLeadDto(
                link.LeadId,
                link.ApplicantName ?? "Unknown",
                link.LeadSource,
                link.LeadStatus,
                link.CreatedAt,
                link.LinkedAt,
                link.VehicleRegistrationNumber,
                vehicleAction));
        }

        return result;
    }
}

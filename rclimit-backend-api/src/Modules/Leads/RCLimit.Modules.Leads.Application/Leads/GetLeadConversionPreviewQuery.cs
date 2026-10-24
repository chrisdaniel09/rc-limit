using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Loans.Contracts.Customers;
using RCLimit.Modules.Loans.Contracts.Vehicles;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Leads;

public record GetLeadConversionPreviewQuery(Guid LeadId, Guid? SelectedCustomerId = null) : IRequest<LeadConversionPreviewDto>;

public record LeadConversionPreviewDto(
    List<CustomerMatchDto> CustomerMatches,
    VehiclePreviewDto Vehicle);

public record CustomerMatchDto(
    Guid CustomerId,
    string LegalName,
    string? PhoneNumber,
    string MatchedOn,
    IReadOnlyList<string> MatchReasons,
    int VehicleCount,
    int PreviousLeadCount,
    DateTime? LastLeadAt);

public record VehiclePreviewDto(
    string RegistrationNumber,
    string Status, // NONE | NEW | SAME_OWNER | OWNED_BY_OTHER | BLOCKED
    string? CurrentOwnerName);

public class GetLeadConversionPreviewQueryHandler : IRequestHandler<GetLeadConversionPreviewQuery, LeadConversionPreviewDto>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ICustomersModuleApi _customers;
    private readonly IVehiclesModuleApi _vehicles;

    public GetLeadConversionPreviewQueryHandler(
        ILeadsDbContext db,
        ITenantContext tenant,
        ICustomersModuleApi customers,
        IVehiclesModuleApi vehicles)
    {
        _db = db;
        _tenant = tenant;
        _customers = customers;
        _vehicles = vehicles;
    }

    public async Task<LeadConversionPreviewDto> Handle(GetLeadConversionPreviewQuery request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.LeadId == request.LeadId && l.TenantId == _tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        var candidates = await LeadCustomerMatcher.FindAsync(_customers, _vehicles, lead, cancellationToken);
        var customerMatches = await BuildMatchesAsync(candidates, cancellationToken);

        var vehiclePreview = await BuildVehiclePreviewAsync(lead, request.SelectedCustomerId, cancellationToken);

        return new LeadConversionPreviewDto(customerMatches, vehiclePreview);
    }

    private async Task<VehiclePreviewDto> BuildVehiclePreviewAsync(Lead lead, Guid? selectedCustomerId, CancellationToken cancellationToken)
    {
        var status = "NONE";
        string? currentOwnerName = null;

        if (!string.IsNullOrWhiteSpace(lead.VehicleRegistrationNumber))
        {
            var preview = await _vehicles.GetOwnershipPreviewAsync(lead.VehicleRegistrationNumber, selectedCustomerId, cancellationToken);
            status = preview.Status;
            currentOwnerName = preview.CurrentOwnerName;
        }

        return new VehiclePreviewDto(lead.VehicleRegistrationNumber ?? "", status, currentOwnerName);
    }

    // Batched lookups for the whole candidate list, instead of several queries per candidate.
    private async Task<List<CustomerMatchDto>> BuildMatchesAsync(
        IReadOnlyList<CustomerMatchCandidate> candidates,
        CancellationToken cancellationToken)
    {
        if (candidates.Count == 0)
            return [];

        var customerIds = candidates.Select(c => c.CustomerId).ToList();

        var vehicleCounts = await _vehicles.GetOpenVehicleCountsAsync(customerIds, cancellationToken);

        // Lead-link statistics are Leads data.
        var leadStats = await _db.LeadCustomers
            .AsNoTracking()
            .Where(lc => lc.TenantId == _tenant.TenantId && customerIds.Contains(lc.CustomerId))
            .GroupBy(lc => lc.CustomerId)
            .Select(g => new { CustomerId = g.Key, Count = g.Count(), LastLinkedAt = g.Max(lc => (DateTime?)lc.LinkedAt) })
            .ToDictionaryAsync(x => x.CustomerId, cancellationToken);

        return candidates.Select(c =>
        {
            leadStats.TryGetValue(c.CustomerId, out var stats);
            return new CustomerMatchDto(
                c.CustomerId,
                c.LegalName,
                c.PhoneNumber,
                c.Reasons[0],
                c.Reasons,
                vehicleCounts.GetValueOrDefault(c.CustomerId),
                stats?.Count ?? 0,
                stats?.LastLinkedAt);
        }).ToList();
    }
}

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

// Vehicle is null when the lead's financial requirement has no vehicle.
public record LeadConversionPreviewDto(
    List<CustomerMatchDto> CustomerMatches,
    VehiclePreviewDto? Vehicle);

public record CustomerMatchDto(
    Guid CustomerId,
    string LegalName,
    string? PhoneNumber,
    string MatchedOn,
    IReadOnlyList<string> MatchReasons,
    int VehicleCount,
    int PreviousLeadCount,
    DateTime? LastLeadAt);

// Status: NONE | NEW | SAME_OWNER | OWNED_BY_OTHER | BLOCKED
// Conflicts lists the fields where the lead's value differs from the vehicle's. Each needs a decision before converting.
public record VehiclePreviewDto(
    string RegistrationNumber,
    string Status,
    string? CurrentOwnerName,
    VehicleDetailsDto Details,
    List<VehicleConflictPreviewDto> Conflicts);

// Role is the vehicle role from the product's field schema, so the UI can key its decisions the same way.
public record VehicleConflictPreviewDto(
    string Role,
    string Field,
    string? CurrentValue,
    string? LeadValue);

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

    private async Task<VehiclePreviewDto?> BuildVehiclePreviewAsync(Lead lead, Guid? selectedCustomerId, CancellationToken cancellationToken)
    {
        var productType = await _db.ProductTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.TenantId == _tenant.TenantId && p.Code == lead.ProductTypeCode, cancellationToken);

        var details = LeadVehicleDetails.From(lead, productType);
        if (details is null)
            return null;

        var ownership = await _vehicles.GetOwnershipPreviewAsync(details.RegistrationNumber, selectedCustomerId, cancellationToken);
        var conflicts = await _vehicles.GetConflictsAsync(details, cancellationToken);

        var conflictPreviews = conflicts
            .Select(c => new VehicleConflictPreviewDto(
                LeadVehicleDetails.RoleByField[c.Field],
                c.Field,
                c.CurrentValue,
                c.IncomingValue))
            .ToList();

        return new VehiclePreviewDto(
            details.RegistrationNumber,
            ownership.Status,
            ownership.CurrentOwnerName,
            details,
            conflictPreviews);
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

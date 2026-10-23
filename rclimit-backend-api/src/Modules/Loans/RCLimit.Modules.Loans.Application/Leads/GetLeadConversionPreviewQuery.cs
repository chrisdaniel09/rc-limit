using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Leads;

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
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetLeadConversionPreviewQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<LeadConversionPreviewDto> Handle(GetLeadConversionPreviewQuery request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.LeadId == request.LeadId && l.TenantId == _tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        var candidates = await LeadCustomerMatcher.FindAsync(_db, _tenant.TenantId, lead, cancellationToken);
        var customerMatches = await BuildMatchesAsync(candidates, cancellationToken);

        // Get vehicle preview
        var vehicleStatus = "NONE";
        string? currentOwnerName = null;

        if (!string.IsNullOrWhiteSpace(lead.VehicleRegistrationNumber))
        {
            var normalizedReg = LeadCustomerMatcher.NormalizeRegistrationNumber(lead.VehicleRegistrationNumber);
            var vehicle = await _db.Vehicles
                .Where(v => v.TenantId == _tenant.TenantId &&
                    v.RegistrationNumber.ToUpper() == normalizedReg)
                .FirstOrDefaultAsync(cancellationToken);

            if (vehicle == null)
            {
                vehicleStatus = "NEW";
            }
            else if (vehicle.OwnerCustomerId == request.SelectedCustomerId)
            {
                vehicleStatus = "SAME_OWNER";
            }
            else if (vehicle.OwnerCustomerId.HasValue)
            {
                // Check if vehicle has open loan under the current owner
                var hasOpenLoan = await _db.LoanTransactions
                    .Where(lt => lt.VehicleId == vehicle.VehicleId &&
                        lt.CustomerId == vehicle.OwnerCustomerId &&
                        lt.LoanStatus == "DISBURSED_RC_PENDING")
                    .AnyAsync(cancellationToken);

                if (hasOpenLoan)
                {
                    vehicleStatus = "BLOCKED";
                }
                else
                {
                    vehicleStatus = "OWNED_BY_OTHER";
                    var owner = await _db.Customers
                        .FirstOrDefaultAsync(c => c.CustomerId == vehicle.OwnerCustomerId, cancellationToken);
                    currentOwnerName = owner?.LegalName;
                }
            }
        }

        var vehiclePreview = new VehiclePreviewDto(
            lead.VehicleRegistrationNumber ?? "",
            vehicleStatus,
            currentOwnerName);

        return new LeadConversionPreviewDto(customerMatches, vehiclePreview);
    }

    // Three batched queries for the whole candidate list, instead of three queries per candidate.
    private async Task<List<CustomerMatchDto>> BuildMatchesAsync(
        IReadOnlyList<CustomerMatchCandidate> candidates,
        CancellationToken cancellationToken)
    {
        if (candidates.Count == 0)
            return [];

        var customerIds = candidates.Select(c => c.CustomerId).ToList();

        var vehicleCounts = await _db.CustomerVehicles
            .AsNoTracking()
            .Where(cv => cv.TenantId == _tenant.TenantId && customerIds.Contains(cv.CustomerId) && cv.OwnedTo == null)
            .GroupBy(cv => cv.CustomerId)
            .Select(g => new { CustomerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CustomerId, x => x.Count, cancellationToken);

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

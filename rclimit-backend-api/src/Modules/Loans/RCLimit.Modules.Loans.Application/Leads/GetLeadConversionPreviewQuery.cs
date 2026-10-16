using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
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
            ?? throw new Exception($"Lead {request.LeadId} not found");

        // Get customer matches (phone and name, phone first)
        var phoneLastDigits = lead.ContactPhone?.TakeLast(10).ToString() ?? lead.WhatsappPhoneNumber?.TakeLast(10).ToString() ?? "";
        var applicantNameLower = lead.ApplicantName?.ToLower() ?? "";

        var phoneMatches = await _db.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == _tenant.TenantId && c.PhoneNumber != null && c.PhoneNumber.EndsWith(phoneLastDigits))
            .Select(c => new
            {
                c.CustomerId,
                c.LegalName,
                c.PhoneNumber,
                MatchedOn = "PHONE"
            })
            .ToListAsync(cancellationToken);

        var nameMatches = await _db.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == _tenant.TenantId &&
                (c.LegalName.ToLower().Contains(applicantNameLower) ||
                 (c.TradeName != null && c.TradeName.ToLower().Contains(applicantNameLower))))
            .Where(c => !phoneMatches.Any(pm => pm.CustomerId == c.CustomerId))
            .Select(c => new
            {
                c.CustomerId,
                c.LegalName,
                c.PhoneNumber,
                MatchedOn = "NAME"
            })
            .ToListAsync(cancellationToken);

        var allMatches = phoneMatches.Concat(nameMatches).ToList();

        var customerMatches = new List<CustomerMatchDto>();
        foreach (var match in allMatches)
        {
            var vehicleCount = await _db.CustomerVehicles
                .AsNoTracking()
                .CountAsync(cv => cv.CustomerId == match.CustomerId && cv.OwnedTo == null, cancellationToken);

            var previousLeadCount = await _db.LeadCustomers
                .AsNoTracking()
                .CountAsync(lc => lc.CustomerId == match.CustomerId && lc.TenantId == _tenant.TenantId, cancellationToken);

            var lastLeadAt = await _db.LeadCustomers
                .AsNoTracking()
                .Where(lc => lc.CustomerId == match.CustomerId && lc.TenantId == _tenant.TenantId)
                .OrderByDescending(lc => lc.LinkedAt)
                .Select(lc => (DateTime?)lc.LinkedAt)
                .FirstOrDefaultAsync(cancellationToken);

            customerMatches.Add(new CustomerMatchDto(
                match.CustomerId,
                match.LegalName,
                match.PhoneNumber,
                match.MatchedOn,
                vehicleCount,
                previousLeadCount,
                lastLeadAt));
        }

        // Get vehicle preview
        var vehicleStatus = "NONE";
        string? currentOwnerName = null;

        if (!string.IsNullOrWhiteSpace(lead.VehicleRegistrationNumber))
        {
            var normalizedReg = NormalizeRegistrationNumber(lead.VehicleRegistrationNumber);
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

    private static string NormalizeRegistrationNumber(string regNo)
    {
        return System.Text.RegularExpressions.Regex.Replace(regNo.ToUpper().Trim(), @"[\s\-]", "");
    }
}

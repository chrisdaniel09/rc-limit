using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.ValueObjects;

namespace RCLimit.Modules.Loans.Application.Leads;

public record ConvertLeadToCustomerCommand(
    Guid LeadId,
    string? CustomerType = null,
    decimal? AssignedCeiling = null,
    Guid? ExistingCustomerId = null,
    bool ConfirmVehicleTransfer = false,
    int MaxPendingRcAllowed = 5) : IRequest<Guid>;

public class ConvertLeadToCustomerCommandHandler : IRequestHandler<ConvertLeadToCustomerCommand, Guid>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public ConvertLeadToCustomerCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(ConvertLeadToCustomerCommand request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        if (lead.ConvertedCustomerId.HasValue)
            throw new BusinessRuleException("This lead has already been converted to a customer.");

        // Determine the customer (new or existing)
        Guid customerId;
        string linkType;
        string? matchBasis = null;

        if (request.ExistingCustomerId.HasValue)
        {
            // Link to existing customer
            var existingCustomer = await _db.Customers
                .FindAsync(new object[] { request.ExistingCustomerId.Value }, cancellationToken);

            if (existingCustomer == null || existingCustomer.TenantId != _tenant.TenantId)
                throw new BusinessRuleException("Existing customer not found.");

            customerId = request.ExistingCustomerId.Value;
            linkType = "LINKED_EXISTING";
            // Determine match basis (could be from preview logic, but simplified here)
            matchBasis = "MANUAL";
        }
        else
        {
            // Create new customer
            if (string.IsNullOrWhiteSpace(request.CustomerType) || !request.AssignedCeiling.HasValue)
                throw new BusinessRuleException("CustomerType and AssignedCeiling are required when creating a new customer.");

            var customer = new Customer
            {
                CustomerId = Guid.NewGuid(),
                TenantId = _tenant.TenantId,
                CustomerType = request.CustomerType,
                LegalName = lead.ApplicantName ?? "Unknown",
                PhoneNumber = lead.ContactPhone ?? lead.WhatsappPhoneNumber,
                CibilScore = lead.CibilScorePreview,
                CibilTier = DetermineCibilTier(lead.CibilScorePreview)
            };

            var subLimit = new CustomerSubLimit
            {
                SubLimitId = Guid.NewGuid(),
                CustomerId = customer.CustomerId,
                AssignedCeiling = request.AssignedCeiling.Value,
                MaxPendingRcAllowed = request.MaxPendingRcAllowed
            };

            customerId = customer.CustomerId;
            linkType = "CREATED";

            _db.Customers.Add(customer);
            _db.CustomerSubLimits.Add(subLimit);
        }

        // Handle vehicle
        Guid? vehicleId = null;
        if (!string.IsNullOrWhiteSpace(lead.VehicleRegistrationNumber))
        {
            vehicleId = await HandleVehicleConversion(lead, customerId, request.ConfirmVehicleTransfer, cancellationToken);
        }

        // Create lead_customers record
        var leadCustomer = new LeadCustomer
        {
            LeadCustomerId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            LeadId = request.LeadId,
            CustomerId = customerId,
            LinkType = linkType,
            MatchBasis = matchBasis,
            LinkedByUserId = _tenant.UserId,
            LinkedAt = DateTime.UtcNow
        };

        // Update lead
        lead.ConvertedCustomerId = customerId;
        lead.ConvertedAt = DateTime.UtcNow;
        lead.LeadStatus = LeadStatuses.Converted;
        lead.UpdatedAt = DateTime.UtcNow;

        _db.LeadCustomers.Add(leadCustomer);
        await _db.SaveChangesAsync(cancellationToken);

        return customerId;
    }

    private async Task<Guid?> HandleVehicleConversion(Lead lead, Guid customerId, bool confirmTransfer, CancellationToken cancellationToken)
    {
        var normalizedReg = NormalizeRegistrationNumber(lead.VehicleRegistrationNumber!);
        var vehicle = await _db.Vehicles
            .Where(v => v.TenantId == _tenant.TenantId &&
                v.RegistrationNumber.ToUpper() == normalizedReg)
            .FirstOrDefaultAsync(cancellationToken);

        if (vehicle == null)
        {
            // Create new vehicle
            var newVehicle = new Vehicle
            {
                VehicleId = Guid.NewGuid(),
                TenantId = _tenant.TenantId,
                RegistrationNumber = lead.VehicleRegistrationNumber,
                OwnerCustomerId = customerId
            };

            _db.Vehicles.Add(newVehicle);
            await _db.SaveChangesAsync(cancellationToken);

            var ownership = new CustomerVehicle
            {
                CustomerVehicleId = Guid.NewGuid(),
                TenantId = _tenant.TenantId,
                CustomerId = customerId,
                VehicleId = newVehicle.VehicleId,
                SourceLeadId = lead.LeadId,
                OwnedFrom = DateTime.UtcNow,
                OwnedTo = null,
                EndReason = null
            };

            _db.CustomerVehicles.Add(ownership);
            await _db.SaveChangesAsync(cancellationToken);

            return newVehicle.VehicleId;
        }
        else if (vehicle.OwnerCustomerId == customerId)
        {
            // Already owned by this customer, just link via source_lead_id
            var existingOwnership = await _db.CustomerVehicles
                .FirstOrDefaultAsync(cv => cv.VehicleId == vehicle.VehicleId && cv.OwnedTo == null, cancellationToken);

            if (existingOwnership != null)
            {
                existingOwnership.SourceLeadId = lead.LeadId;
                await _db.SaveChangesAsync(cancellationToken);
            }

            return vehicle.VehicleId;
        }
        else
        {
            // Vehicle owned by another customer
            if (!confirmTransfer)
                throw new BusinessRuleException("Vehicle is owned by another customer. Confirm transfer to proceed.");

            // Check for open loans
            var hasOpenLoan = await _db.LoanTransactions
                .AsNoTracking()
                .AnyAsync(lt => lt.VehicleId == vehicle.VehicleId &&
                    lt.CustomerId == vehicle.OwnerCustomerId &&
                    lt.LoanStatus == "DISBURSED_RC_PENDING", cancellationToken);

            if (hasOpenLoan)
                throw new BusinessRuleException("Cannot transfer vehicle with an open loan.");

            // Close previous ownership
            var previousOwnership = await _db.CustomerVehicles
                .FirstOrDefaultAsync(cv => cv.VehicleId == vehicle.VehicleId && cv.OwnedTo == null, cancellationToken);

            if (previousOwnership != null)
            {
                previousOwnership.OwnedTo = DateTime.UtcNow;
                previousOwnership.EndReason = "TRANSFERRED";
            }

            // Transfer vehicle
            vehicle.OwnerCustomerId = customerId;

            // Create new ownership record
            var newOwnership = new CustomerVehicle
            {
                CustomerVehicleId = Guid.NewGuid(),
                TenantId = _tenant.TenantId,
                CustomerId = customerId,
                VehicleId = vehicle.VehicleId,
                SourceLeadId = lead.LeadId,
                OwnedFrom = DateTime.UtcNow,
                OwnedTo = null,
                EndReason = null
            };

            _db.CustomerVehicles.Add(newOwnership);
            await _db.SaveChangesAsync(cancellationToken);

            return vehicle.VehicleId;
        }
    }

    private static string NormalizeRegistrationNumber(string regNo)
    {
        return System.Text.RegularExpressions.Regex.Replace(regNo.ToUpper().Trim(), @"[\s\-]", "");
    }

    private static string? DetermineCibilTier(int? score)
    {
        if (!score.HasValue)
            return null;

        return score >= 750 ? "GREEN" :
               score >= 650 ? "AMBER" :
               "RED";
    }
}

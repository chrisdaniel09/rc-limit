using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Loans.Contracts.Customers;
using RCLimit.Modules.Loans.Contracts.Vehicles;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.Leads;

public record ConvertLeadToCustomerCommand(
    Guid LeadId,
    string? CustomerType = null,
    decimal? AssignedCeiling = null,
    Guid? ExistingCustomerId = null,
    bool ConfirmVehicleTransfer = false,
    int MaxPendingRcAllowed = 5) : IRequest<Guid>;

public class ConvertLeadToCustomerCommandHandler : IRequestHandler<ConvertLeadToCustomerCommand, Guid>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly ICustomersModuleApi _customers;
    private readonly IVehiclesModuleApi _vehicles;

    public ConvertLeadToCustomerCommandHandler(
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

    public async Task<Guid> Handle(ConvertLeadToCustomerCommand request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        if (lead.ConvertedCustomerId.HasValue)
            throw new BusinessRuleException("This lead has already been converted to a customer.");

        var hasVehicle = !string.IsNullOrWhiteSpace(lead.VehicleRegistrationNumber);
        var registrationNumber = lead.VehicleRegistrationNumber;

        Guid customerId;
        string linkType;
        string? matchBasis = null;

        if (request.ExistingCustomerId.HasValue)
        {
            // Link to existing customer
            customerId = request.ExistingCustomerId.Value;

            if (!await _customers.ExistsAsync(customerId, cancellationToken))
                throw new BusinessRuleException("Existing customer not found.");

            // Rules are checked before any write, so a rejected vehicle transfer leaves nothing behind.
            if (hasVehicle)
                await _vehicles.EnsureAssignableAsync(registrationNumber!, customerId, request.ConfirmVehicleTransfer, cancellationToken);

            linkType = "LINKED_EXISTING";
            // Record the strongest reason the matcher gives for this customer. A customer picked by search is MANUAL.
            var candidates = await LeadCustomerMatcher.FindAsync(_customers, _vehicles, lead, cancellationToken);
            matchBasis = candidates.FirstOrDefault(c => c.CustomerId == customerId)?.Reasons[0] ?? "MANUAL";
        }
        else
        {
            // Create new customer
            if (string.IsNullOrWhiteSpace(request.CustomerType) || !request.AssignedCeiling.HasValue)
                throw new BusinessRuleException("CustomerType and AssignedCeiling are required when creating a new customer.");

            if (hasVehicle)
                await _vehicles.EnsureAssignableAsync(registrationNumber!, null, request.ConfirmVehicleTransfer, cancellationToken);

            customerId = await _customers.CreateFromLeadAsync(new CreateCustomerFromLeadRequest(
                CustomerType: request.CustomerType,
                AssignedCeiling: request.AssignedCeiling.Value,
                MaxPendingRcAllowed: request.MaxPendingRcAllowed,
                LegalName: lead.ApplicantName ?? "Unknown",
                PhoneNumber: lead.ContactPhone ?? lead.WhatsappPhoneNumber,
                CibilScore: lead.CibilScorePreview), cancellationToken);

            linkType = "CREATED";
        }

        if (hasVehicle)
            await _vehicles.AssignToCustomerAsync(registrationNumber!, customerId, lead.LeadId, request.ConfirmVehicleTransfer, cancellationToken);

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
}

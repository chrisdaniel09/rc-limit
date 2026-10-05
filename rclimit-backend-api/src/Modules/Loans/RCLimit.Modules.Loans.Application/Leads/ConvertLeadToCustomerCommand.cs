using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.ValueObjects;

namespace RCLimit.Modules.Loans.Application.Leads;

public record ConvertLeadToCustomerCommand(
    Guid LeadId,
    string CustomerType,
    decimal AssignedCeiling,
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
            AssignedCeiling = request.AssignedCeiling,
            MaxPendingRcAllowed = request.MaxPendingRcAllowed
        };

        lead.ConvertedCustomerId = customer.CustomerId;
        lead.ConvertedAt = DateTime.UtcNow;
        lead.LeadStatus = LeadStatuses.Converted;
        lead.UpdatedAt = DateTime.UtcNow;

        _db.Customers.Add(customer);
        _db.CustomerSubLimits.Add(subLimit);
        await _db.SaveChangesAsync(cancellationToken);

        return customer.CustomerId;
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

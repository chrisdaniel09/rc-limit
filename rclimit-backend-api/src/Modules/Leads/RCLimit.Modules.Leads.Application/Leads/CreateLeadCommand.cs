using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Validation;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Leads;

public record CreateLeadCommand(
    string LeadSource,
    Guid? ReferredByUserId,
    string WhatsappPhoneNumber,
    string? ContactPhone,
    string? ApplicantName,
    decimal? RequestedLoanAmount,
    string? VehicleRegistrationNumber,
    Guid? PartnerId,
    string? Notes) : IRequest<Guid>;

public class CreateLeadCommandHandler : IRequestHandler<CreateLeadCommand, Guid>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateLeadCommandHandler(ILeadsDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(CreateLeadCommand request, CancellationToken cancellationToken)
    {
        var whatsappPhoneNumber = IndianMobileNumber.Validate(request.WhatsappPhoneNumber, "WhatsApp phone");
        var contactPhone = IndianMobileNumber.ValidateOptional(request.ContactPhone, "Contact phone");

        var lead = new Lead
        {
            LeadId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            LeadSource = request.LeadSource,
            ReferredByUserId = request.ReferredByUserId,
            WhatsappPhoneNumber = whatsappPhoneNumber,
            ContactPhone = contactPhone,
            ApplicantName = request.ApplicantName,
            RequestedLoanAmount = request.RequestedLoanAmount,
            VehicleRegistrationNumber = request.VehicleRegistrationNumber,
            PartnerId = request.PartnerId,
            Notes = request.Notes
        };

        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(cancellationToken);
        return lead.LeadId;
    }
}

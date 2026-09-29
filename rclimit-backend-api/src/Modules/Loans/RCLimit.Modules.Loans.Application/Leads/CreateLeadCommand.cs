using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Leads;

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
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateLeadCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(CreateLeadCommand request, CancellationToken cancellationToken)
    {
        var lead = new Lead
        {
            LeadId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            LeadSource = request.LeadSource,
            ReferredByUserId = request.ReferredByUserId,
            WhatsappPhoneNumber = request.WhatsappPhoneNumber,
            ContactPhone = request.ContactPhone,
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

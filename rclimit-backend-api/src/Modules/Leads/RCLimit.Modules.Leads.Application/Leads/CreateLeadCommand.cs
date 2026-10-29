using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Domain.Validation;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Application.ProductTypes;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Leads;

// ProductTypeCode and ProductDetails are the product-neutral inputs. RequestedLoanAmount and
// VehicleRegistrationNumber are the legacy inputs, still accepted until the UI sends the new ones.
public record CreateLeadCommand(
    string LeadSource,
    Guid? ReferredByUserId,
    string WhatsappPhoneNumber,
    string? ContactPhone,
    string? ApplicantName,
    decimal? RequestedLoanAmount,
    string? VehicleRegistrationNumber,
    Guid? PartnerId,
    string? Notes,
    string? ProductTypeCode = null,
    Dictionary<string, JsonElement>? ProductDetails = null) : IRequest<Guid>;

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

        var productTypeCode = ProductTypeRules.NormalizeCode(request.ProductTypeCode ?? "USED_CV");
        var productType = await _db.ProductTypes.FirstOrDefaultAsync(
            p => p.TenantId == _tenant.TenantId && p.Code == productTypeCode && p.IsActive, cancellationToken)
            ?? throw new BusinessRuleException($"Financial requirement '{productTypeCode}' was not found or is inactive.");

        var details = request.ProductDetails ?? new Dictionary<string, JsonElement>();
        if (details.Count == 0 && request.VehicleRegistrationNumber is { } legacyRegistration)
            details["registration_number"] = JsonSerializer.SerializeToElement(legacyRegistration);

        var normalizedDetails = ProductFieldValidator.Normalize(productType.FieldSchema, details);
        var referenceNumber = ProductFieldValidator.DeriveReferenceNumber(productType.FieldSchema, normalizedDetails);

        var lead = new Lead
        {
            LeadId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            LeadSource = request.LeadSource,
            ReferredByUserId = request.ReferredByUserId,
            WhatsappPhoneNumber = whatsappPhoneNumber,
            ContactPhone = contactPhone,
            ApplicantName = request.ApplicantName,
            ProductTypeCode = productTypeCode,
            RequestedLoanAmount = request.RequestedLoanAmount,
            ProductDetails = normalizedDetails,
            ReferenceNumber = referenceNumber,
            // Kept filled for the existing screens until they read product details.
            VehicleRegistrationNumber = request.VehicleRegistrationNumber ?? referenceNumber,
            PartnerId = request.PartnerId,
            Notes = request.Notes
        };

        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(cancellationToken);
        return lead.LeadId;
    }
}

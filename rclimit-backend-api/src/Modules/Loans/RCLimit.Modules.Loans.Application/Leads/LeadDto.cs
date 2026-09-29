namespace RCLimit.Modules.Loans.Application.Leads;

public record LeadDto(
    Guid LeadId,
    string LeadSource,
    Guid? ReferredByUserId,
    string? ReferredByUserName,
    string WhatsappPhoneNumber,
    string? ContactPhone,
    string? ApplicantName,
    decimal? RequestedLoanAmount,
    string? VehicleRegistrationNumber,
    string VahanValidationStatus,
    string LeadStatus,
    string? Notes,
    DateTime CreatedAt);

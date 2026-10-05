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
    Guid? AssignedToUserId,
    string? AssignedToUserName,
    string CibilCheckStatus,
    string RcCheckStatus,
    int? CibilScorePreview,
    Guid? ConvertedCustomerId,
    DateTime CreatedAt);

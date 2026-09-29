namespace RCLimit.Modules.Partners.Application.Dtos;

public record PartnerDto(
    Guid PartnerId,
    string PartnerType,
    string LegalName,
    string? PhoneNumber,
    string? Email,
    decimal DefaultCommissionSplitPct,
    string Status);

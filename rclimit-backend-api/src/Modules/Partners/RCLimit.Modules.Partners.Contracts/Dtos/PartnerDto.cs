namespace RCLimit.Modules.Partners.Contracts.Dtos;

public record PartnerDto(
    Guid PartnerId,
    string PartnerType,
    string LegalName,
    string? PhoneNumber,
    decimal DefaultCommissionSplitPct,
    string Status);

using RCLimit.Modules.Partners.Contracts.Dtos;

namespace RCLimit.Modules.Partners.Contracts;

public interface IPartnersModuleApi
{
    Task<PartnerDto?> GetPartnerByIdAsync(Guid partnerId);
}

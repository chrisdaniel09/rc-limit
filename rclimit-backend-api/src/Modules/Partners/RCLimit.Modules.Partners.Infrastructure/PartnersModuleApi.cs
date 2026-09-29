using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Partners.Contracts;
using RCLimit.Modules.Partners.Contracts.Dtos;
using RCLimit.Modules.Partners.Infrastructure.Persistence;

namespace RCLimit.Modules.Partners.Infrastructure;

public class PartnersModuleApi : IPartnersModuleApi
{
    private readonly PartnersDbContext _db;

    public PartnersModuleApi(PartnersDbContext db)
    {
        _db = db;
    }

    public async Task<PartnerDto?> GetPartnerByIdAsync(Guid partnerId)
    {
        return await _db.Partners
            .Where(p => p.PartnerId == partnerId)
            .Select(p => new PartnerDto(
                p.PartnerId,
                p.PartnerType,
                p.LegalName,
                p.PhoneNumber,
                p.DefaultCommissionSplitPct,
                p.Status))
            .FirstOrDefaultAsync();
    }
}

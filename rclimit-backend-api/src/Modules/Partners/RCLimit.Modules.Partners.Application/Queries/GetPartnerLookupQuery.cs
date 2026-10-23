using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Partners.Application.Abstractions;

namespace RCLimit.Modules.Partners.Application.Queries;

// Unpaged id + name list for dropdowns. Not for browsing; use GetPartnersQuery for that.
public record PartnerLookupDto(Guid PartnerId, string LegalName);

public record GetPartnerLookupQuery : IRequest<List<PartnerLookupDto>>;

public class GetPartnerLookupQueryHandler : IRequestHandler<GetPartnerLookupQuery, List<PartnerLookupDto>>
{
    private readonly IPartnersDbContext _db;
    private readonly ITenantContext _tenant;

    public GetPartnerLookupQueryHandler(IPartnersDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<PartnerLookupDto>> Handle(GetPartnerLookupQuery request, CancellationToken cancellationToken)
    {
        return await _db.Partners
            .Where(p => p.TenantId == _tenant.TenantId)
            .OrderBy(p => p.LegalName)
            .Select(p => new PartnerLookupDto(p.PartnerId, p.LegalName))
            .ToListAsync(cancellationToken);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Partners.Application.Abstractions;
using RCLimit.Modules.Partners.Application.Dtos;

namespace RCLimit.Modules.Partners.Application.Queries;

public record GetPartnersQuery : IRequest<List<PartnerDto>>;

public class GetPartnersQueryHandler : IRequestHandler<GetPartnersQuery, List<PartnerDto>>
{
    private readonly IPartnersDbContext _db;
    private readonly ITenantContext _tenant;

    public GetPartnersQueryHandler(IPartnersDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<PartnerDto>> Handle(GetPartnersQuery request, CancellationToken cancellationToken)
    {
        return await _db.Partners
            .Where(p => p.TenantId == _tenant.TenantId)
            .Select(p => new PartnerDto(
                p.PartnerId,
                p.PartnerType,
                p.LegalName,
                p.PhoneNumber,
                p.Email,
                p.DefaultCommissionSplitPct,
                p.Status))
            .ToListAsync(cancellationToken);
    }
}

using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Partners.Application.Abstractions;
using RCLimit.Modules.Partners.Application.Dtos;
using RCLimit.Modules.Partners.Domain.Entities;

namespace RCLimit.Modules.Partners.Application.Queries;

public record GetPartnersQuery(string? Status, PageQuery Paging) : IRequest<PagedResult<PartnerDto>>;

public class GetPartnersQueryHandler : IRequestHandler<GetPartnersQuery, PagedResult<PartnerDto>>
{
    private static readonly Dictionary<string, Expression<Func<Partner, object?>>> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["legalName"] = p => p.LegalName,
        ["partnerType"] = p => p.PartnerType,
        ["status"] = p => p.Status,
    };

    private readonly IPartnersDbContext _db;
    private readonly ITenantContext _tenant;

    public GetPartnersQueryHandler(IPartnersDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<PagedResult<PartnerDto>> Handle(GetPartnersQuery request, CancellationToken cancellationToken)
    {
        var paging = request.Paging;
        var pattern = paging.SearchTerm is { } search ? PageQuery.ContainsPattern(search) : null;

        var query = _db.Partners
            .Where(p => p.TenantId == _tenant.TenantId)
            .Where(p => string.IsNullOrEmpty(request.Status) || p.Status == request.Status)
            .Where(p => pattern == null
                || EF.Functions.Like(p.LegalName.ToLower(), pattern)
                || EF.Functions.Like((p.PhoneNumber ?? "").ToLower(), pattern));

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .ApplySort(paging, SortMap, ("legalName", false), p => p.PartnerId)
            .Skip(paging.Skip)
            .Take(paging.NormalizedPageSize)
            .Select(p => new PartnerDto(
                p.PartnerId,
                p.PartnerType,
                p.LegalName,
                p.PhoneNumber,
                p.Email,
                p.DefaultCommissionSplitPct,
                p.Status))
            .ToListAsync(cancellationToken);

        return new PagedResult<PartnerDto>(items, paging.NormalizedPage, paging.NormalizedPageSize, total);
    }
}

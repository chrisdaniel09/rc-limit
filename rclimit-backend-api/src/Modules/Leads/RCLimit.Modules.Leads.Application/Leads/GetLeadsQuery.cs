using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Leads;

public record GetLeadsQuery(bool AssignedToMe, string? LeadStatus, PageQuery Paging) : IRequest<PagedResult<LeadDto>>;

public class GetLeadsQueryHandler : IRequestHandler<GetLeadsQuery, PagedResult<LeadDto>>
{
    private static readonly Dictionary<string, Expression<Func<Lead, object?>>> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["applicantName"] = l => l.ApplicantName,
        ["leadSource"] = l => l.LeadSource,
        ["cibilCheckStatus"] = l => l.CibilCheckStatus,
        ["rcCheckStatus"] = l => l.RcCheckStatus,
        ["leadStatus"] = l => l.LeadStatus,
        ["createdAt"] = l => l.CreatedAt,
    };

    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IIdentityModuleApi _identity;

    public GetLeadsQueryHandler(ILeadsDbContext db, ITenantContext tenant, IIdentityModuleApi identity)
    {
        _db = db;
        _tenant = tenant;
        _identity = identity;
    }

    public async Task<PagedResult<LeadDto>> Handle(GetLeadsQuery request, CancellationToken cancellationToken)
    {
        var paging = request.Paging;
        var pattern = paging.SearchTerm is { } search ? PageQuery.ContainsPattern(search) : null;

        var query = _db.Leads
            .Where(l => l.TenantId == _tenant.TenantId)
            .Where(l => !request.AssignedToMe || l.AssignedToUserId == _tenant.UserId)
            .Where(l => string.IsNullOrEmpty(request.LeadStatus) || l.LeadStatus == request.LeadStatus)
            .Where(l => pattern == null
                || EF.Functions.Like((l.ApplicantName ?? "").ToLower(), pattern)
                || EF.Functions.Like(l.WhatsappPhoneNumber.ToLower(), pattern)
                || EF.Functions.Like((l.ContactPhone ?? "").ToLower(), pattern)
                || EF.Functions.Like((l.VehicleRegistrationNumber ?? "").ToLower(), pattern));

        var total = await query.CountAsync(cancellationToken);

        var leads = await query
            .ApplySort(paging, SortMap, ("createdAt", true), l => l.LeadId)
            .Skip(paging.Skip)
            .Take(paging.NormalizedPageSize)
            .ToListAsync(cancellationToken);

        var userIds = leads
            .SelectMany(l => new[] { l.ReferredByUserId, l.AssignedToUserId }.Where(id => id.HasValue).Cast<Guid>())
            .Distinct()
            .ToList();

        var userNames = new Dictionary<Guid, string>();
        foreach (var uid in userIds)
        {
            var user = await _identity.GetUserByIdAsync(uid, cancellationToken);
            if (user is not null)
                userNames[uid] = user.FullName ?? user.Email ?? uid.ToString();
        }

        var items = leads.Select(l => new LeadDto(
            l.LeadId,
            l.LeadSource,
            l.ReferredByUserId,
            l.ReferredByUserId.HasValue && userNames.TryGetValue(l.ReferredByUserId.Value, out var refName) ? refName : null,
            l.WhatsappPhoneNumber,
            l.ContactPhone,
            l.ApplicantName,
            l.RequestedLoanAmount,
            l.VehicleRegistrationNumber,
            l.VahanValidationStatus,
            l.LeadStatus,
            l.Notes,
            l.AssignedToUserId,
            l.AssignedToUserId.HasValue && userNames.TryGetValue(l.AssignedToUserId.Value, out var assignName) ? assignName : null,
            l.CibilCheckStatus,
            l.RcCheckStatus,
            l.CibilScorePreview,
            l.ConvertedCustomerId,
            l.CreatedAt,
            l.ProductTypeCode,
            l.ReferenceNumber)).ToList();

        return new PagedResult<LeadDto>(items, paging.NormalizedPage, paging.NormalizedPageSize, total);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Leads;

public record GetLeadsQuery : IRequest<List<LeadDto>>;

public class GetLeadsQueryHandler : IRequestHandler<GetLeadsQuery, List<LeadDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IIdentityModuleApi _identity;

    public GetLeadsQueryHandler(ILoansDbContext db, ITenantContext tenant, IIdentityModuleApi identity)
    {
        _db = db;
        _tenant = tenant;
        _identity = identity;
    }

    public async Task<List<LeadDto>> Handle(GetLeadsQuery request, CancellationToken cancellationToken)
    {
        var leads = await _db.Leads
            .Where(l => l.TenantId == _tenant.TenantId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        var userIds = leads.Where(l => l.ReferredByUserId.HasValue).Select(l => l.ReferredByUserId!.Value).Distinct().ToList();
        var userNames = new Dictionary<Guid, string>();
        foreach (var uid in userIds)
        {
            var user = await _identity.GetUserByIdAsync(uid, cancellationToken);
            if (user is not null)
                userNames[uid] = user.FullName ?? user.Email ?? uid.ToString();
        }

        return leads.Select(l => new LeadDto(
            l.LeadId,
            l.LeadSource,
            l.ReferredByUserId,
            l.ReferredByUserId.HasValue && userNames.TryGetValue(l.ReferredByUserId.Value, out var name) ? name : null,
            l.WhatsappPhoneNumber,
            l.ContactPhone,
            l.ApplicantName,
            l.RequestedLoanAmount,
            l.VehicleRegistrationNumber,
            l.VahanValidationStatus,
            l.LeadStatus,
            l.Notes,
            l.CreatedAt)).ToList();
    }
}

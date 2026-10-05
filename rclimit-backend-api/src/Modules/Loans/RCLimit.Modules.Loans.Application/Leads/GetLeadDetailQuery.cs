using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Leads;

public record GetLeadDetailQuery(Guid LeadId) : IRequest<LeadDetailDto>;

public record LeadCheckLogDto(
    Guid LogId,
    string CheckType,
    string Status,
    int? Score,
    string? Remarks,
    string Source,
    Guid PerformedByUserId,
    string? PerformedByUserName,
    DateTime CreatedAt);

public record LeadDetailDto(
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
    List<LeadCheckLogDto> CheckHistory,
    DateTime CreatedAt);

public class GetLeadDetailQueryHandler : IRequestHandler<GetLeadDetailQuery, LeadDetailDto>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IIdentityModuleApi _identity;

    public GetLeadDetailQueryHandler(ILoansDbContext db, ITenantContext tenant, IIdentityModuleApi identity)
    {
        _db = db;
        _tenant = tenant;
        _identity = identity;
    }

    public async Task<LeadDetailDto> Handle(GetLeadDetailQuery request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        var checkLogs = await _db.LeadCheckLogs
            .Where(l => l.LeadId == request.LeadId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        var userIds = new List<Guid>();
        if (lead.ReferredByUserId.HasValue)
            userIds.Add(lead.ReferredByUserId.Value);
        if (lead.AssignedToUserId.HasValue)
            userIds.Add(lead.AssignedToUserId.Value);
        userIds.AddRange(checkLogs.Select(l => l.PerformedByUserId));

        var userNames = new Dictionary<Guid, string>();
        foreach (var uid in userIds.Distinct())
        {
            var user = await _identity.GetUserByIdAsync(uid, cancellationToken);
            if (user is not null)
                userNames[uid] = user.FullName ?? user.Email ?? uid.ToString();
        }

        var checkHistoryDtos = checkLogs.Select(l => new LeadCheckLogDto(
            l.LogId,
            l.CheckType,
            l.Status,
            l.Score,
            l.Remarks,
            l.Source,
            l.PerformedByUserId,
            userNames.TryGetValue(l.PerformedByUserId, out var userName) ? userName : null,
            l.CreatedAt)).ToList();

        string? refUserName = null;
        if (lead.ReferredByUserId.HasValue && userNames.TryGetValue(lead.ReferredByUserId.Value, out var refName))
            refUserName = refName;

        string? assignUserName = null;
        if (lead.AssignedToUserId.HasValue && userNames.TryGetValue(lead.AssignedToUserId.Value, out var assignName))
            assignUserName = assignName;

        return new LeadDetailDto(
            lead.LeadId,
            lead.LeadSource,
            lead.ReferredByUserId,
            refUserName,
            lead.WhatsappPhoneNumber,
            lead.ContactPhone,
            lead.ApplicantName,
            lead.RequestedLoanAmount,
            lead.VehicleRegistrationNumber,
            lead.VahanValidationStatus,
            lead.LeadStatus,
            lead.Notes,
            lead.AssignedToUserId,
            assignUserName,
            lead.CibilCheckStatus,
            lead.RcCheckStatus,
            lead.CibilScorePreview,
            lead.ConvertedCustomerId,
            checkHistoryDtos,
            lead.CreatedAt);
    }
}

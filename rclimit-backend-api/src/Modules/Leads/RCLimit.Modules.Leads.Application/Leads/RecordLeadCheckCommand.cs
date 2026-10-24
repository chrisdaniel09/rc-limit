using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.Leads;

public record RecordLeadCheckCommand(
    Guid LeadId,
    string CheckType,
    string Status,
    int? Score,
    string? Remarks) : IRequest;

public class RecordLeadCheckCommandHandler : IRequestHandler<RecordLeadCheckCommand>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;

    public RecordLeadCheckCommandHandler(ILeadsDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task Handle(RecordLeadCheckCommand request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        if (lead.ConvertedCustomerId.HasValue || lead.LeadStatus == "CONVERTED")
            throw new BusinessRuleException("Cannot record a check for a converted lead.");

        var checkLog = new LeadCheckLog
        {
            LogId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            LeadId = request.LeadId,
            CheckType = request.CheckType,
            Status = request.Status,
            Score = request.Score,
            Remarks = request.Remarks,
            Source = CheckSources.Manual,
            PerformedByUserId = _tenant.UserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.LeadCheckLogs.Add(checkLog);

        if (request.CheckType == CheckTypes.Cibil)
        {
            lead.CibilCheckStatus = request.Status;
            lead.CibilCheckedAt = DateTime.UtcNow;
            if (request.Score.HasValue)
                lead.CibilScorePreview = request.Score;
        }
        else if (request.CheckType == CheckTypes.Rc)
        {
            lead.RcCheckStatus = request.Status;
            lead.RcCheckedAt = DateTime.UtcNow;
        }

        lead.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }
}

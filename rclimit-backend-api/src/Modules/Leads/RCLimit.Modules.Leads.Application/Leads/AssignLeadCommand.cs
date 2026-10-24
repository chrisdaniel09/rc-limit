using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Abstractions;

namespace RCLimit.Modules.Leads.Application.Leads;

public record AssignLeadCommand(Guid LeadId, Guid? AssigneeUserId) : IRequest;

public class AssignLeadCommandHandler : IRequestHandler<AssignLeadCommand>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;

    public AssignLeadCommandHandler(ILeadsDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task Handle(AssignLeadCommand request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        if (lead.ConvertedCustomerId.HasValue || lead.LeadStatus == "CONVERTED")
            throw new BusinessRuleException("Cannot assign a converted lead.");

        lead.AssignedToUserId = request.AssigneeUserId;
        lead.AssignedAt = request.AssigneeUserId.HasValue ? DateTime.UtcNow : null;
        lead.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
    }
}

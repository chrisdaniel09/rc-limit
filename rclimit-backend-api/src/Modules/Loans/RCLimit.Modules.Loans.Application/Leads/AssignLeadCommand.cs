using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Leads;

public record AssignLeadCommand(Guid LeadId, Guid? AssigneeUserId) : IRequest;

public class AssignLeadCommandHandler : IRequestHandler<AssignLeadCommand>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public AssignLeadCommandHandler(ILoansDbContext db, ITenantContext tenant)
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

        lead.AssignedToUserId = request.AssigneeUserId;
        lead.AssignedAt = request.AssigneeUserId.HasValue ? DateTime.UtcNow : null;
        lead.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
    }
}

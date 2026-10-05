using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.ValueObjects;

namespace RCLimit.Modules.Loans.Application.Leads;

public record UpdateLeadStatusCommand(Guid LeadId, string Status) : IRequest;

public class UpdateLeadStatusCommandHandler : IRequestHandler<UpdateLeadStatusCommand>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public UpdateLeadStatusCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task Handle(UpdateLeadStatusCommand request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        if (request.Status == LeadStatuses.Converted)
            throw new BusinessRuleException("Cannot directly set status to CONVERTED. Use the conversion endpoint instead.");

        if (lead.LeadStatus == LeadStatuses.Converted)
            throw new BusinessRuleException("Cannot change status of an already converted lead.");

        lead.LeadStatus = request.Status;
        lead.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
    }
}

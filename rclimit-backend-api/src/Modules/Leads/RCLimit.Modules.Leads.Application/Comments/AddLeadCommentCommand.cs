using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Comments;

public record AddLeadCommentCommand(Guid LeadId, string Text) : IRequest<Unit>;

public class AddLeadCommentCommandHandler : IRequestHandler<AddLeadCommentCommand, Unit>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;

    public AddLeadCommentCommandHandler(ILeadsDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Unit> Handle(AddLeadCommentCommand request, CancellationToken cancellationToken)
    {
        var trimmedText = request.Text?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(trimmedText))
            throw new BusinessRuleException("Comment text cannot be empty");

        if (trimmedText.Length > 2000)
            throw new BusinessRuleException("Comment text cannot exceed 2000 characters");

        var leadExists = await _db.Leads.AnyAsync(l => l.LeadId == request.LeadId && l.TenantId == _tenant.TenantId, cancellationToken);
        if (!leadExists)
            throw new NotFoundException("LEAD", request.LeadId);

        _db.LeadComments.Add(new LeadComment
        {
            CommentId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            LeadId = request.LeadId,
            CommentText = trimmedText,
            CreatedByUserId = _tenant.UserId,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

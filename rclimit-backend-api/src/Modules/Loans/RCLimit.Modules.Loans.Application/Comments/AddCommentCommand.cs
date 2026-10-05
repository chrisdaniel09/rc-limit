using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.ValueObjects;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Comments;

public record AddCommentCommand(string EntityType, Guid EntityId, string Text) : IRequest<Unit>;

public class AddCommentCommandHandler : IRequestHandler<AddCommentCommand, Unit>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public AddCommentCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Unit> Handle(AddCommentCommand request, CancellationToken cancellationToken)
    {
        var trimmedText = request.Text?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(trimmedText))
            throw new BusinessRuleException("Comment text cannot be empty");

        if (trimmedText.Length > 2000)
            throw new BusinessRuleException("Comment text cannot exceed 2000 characters");

        // Verify entity exists and belongs to this tenant
        bool entityExists = request.EntityType switch
        {
            CommentEntityTypes.Lead => await _db.Leads.AnyAsync(l => l.LeadId == request.EntityId && l.TenantId == _tenant.TenantId, cancellationToken),
            CommentEntityTypes.Customer => await _db.Customers.AnyAsync(c => c.CustomerId == request.EntityId && c.TenantId == _tenant.TenantId, cancellationToken),
            CommentEntityTypes.Loan => false, // Loan support to be added later
            _ => throw new BusinessRuleException($"Invalid entity type: {request.EntityType}")
        };

        if (!entityExists)
            throw new NotFoundException(request.EntityType, request.EntityId);

        var comment = new EntityComment
        {
            CommentId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            CommentText = trimmedText,
            CreatedByUserId = _tenant.UserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.EntityComments.Add(comment);
        await _db.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}

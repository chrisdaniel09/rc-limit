using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Comments;

public record GetCommentsQuery(string EntityType, Guid EntityId) : IRequest<List<CommentDto>>;

public class GetCommentsQueryHandler : IRequestHandler<GetCommentsQuery, List<CommentDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IIdentityModuleApi _identity;

    public GetCommentsQueryHandler(ILoansDbContext db, ITenantContext tenant, IIdentityModuleApi identity)
    {
        _db = db;
        _tenant = tenant;
        _identity = identity;
    }

    public async Task<List<CommentDto>> Handle(GetCommentsQuery request, CancellationToken cancellationToken)
    {
        var comments = await _db.EntityComments
            .Where(c => c.TenantId == _tenant.TenantId &&
                        c.EntityType == request.EntityType &&
                        c.EntityId == request.EntityId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        // Batch load user names
        var userIds = comments.Select(c => c.CreatedByUserId).Distinct().ToList();
        var userNames = new Dictionary<Guid, string>();

        foreach (var userId in userIds)
        {
            var user = await _identity.GetUserByIdAsync(userId, cancellationToken);
            if (user is not null)
                userNames[userId] = user.FullName ?? user.Email ?? userId.ToString();
        }

        return comments.Select(c => new CommentDto(
            c.CommentId,
            c.CommentText,
            c.CreatedByUserId,
            userNames.TryGetValue(c.CreatedByUserId, out var userName) ? userName : null,
            c.CreatedAt
        )).ToList();
    }
}

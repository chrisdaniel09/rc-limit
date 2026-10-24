using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Leads.Application.Abstractions;

namespace RCLimit.Modules.Leads.Application.Comments;

public record GetLeadCommentsQuery(Guid LeadId) : IRequest<List<LeadCommentDto>>;

public class GetLeadCommentsQueryHandler : IRequestHandler<GetLeadCommentsQuery, List<LeadCommentDto>>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IIdentityModuleApi _identity;

    public GetLeadCommentsQueryHandler(ILeadsDbContext db, ITenantContext tenant, IIdentityModuleApi identity)
    {
        _db = db;
        _tenant = tenant;
        _identity = identity;
    }

    public async Task<List<LeadCommentDto>> Handle(GetLeadCommentsQuery request, CancellationToken cancellationToken)
    {
        var comments = await _db.LeadComments
            .AsNoTracking()
            .Where(c => c.TenantId == _tenant.TenantId && c.LeadId == request.LeadId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        var userIds = comments.Select(c => c.CreatedByUserId).Distinct().ToList();
        var userNames = new Dictionary<Guid, string>();

        foreach (var userId in userIds)
        {
            var user = await _identity.GetUserByIdAsync(userId, cancellationToken);
            if (user is not null)
                userNames[userId] = user.FullName ?? user.Email ?? userId.ToString();
        }

        return comments.Select(c => new LeadCommentDto(
            c.CommentId,
            c.CommentText,
            c.CreatedByUserId,
            userNames.TryGetValue(c.CreatedByUserId, out var userName) ? userName : null,
            c.CreatedAt
        )).ToList();
    }
}

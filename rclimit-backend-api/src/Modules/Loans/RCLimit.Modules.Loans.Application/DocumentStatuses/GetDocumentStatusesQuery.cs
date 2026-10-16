using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.DocumentStatuses;

public record GetDocumentStatusesQuery : IRequest<List<PostDisbursementDocumentStatusDto>>;

public class GetDocumentStatusesQueryHandler : IRequestHandler<GetDocumentStatusesQuery, List<PostDisbursementDocumentStatusDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetDocumentStatusesQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<PostDisbursementDocumentStatusDto>> Handle(GetDocumentStatusesQuery request, CancellationToken cancellationToken)
    {
        return await _db.PostDisbursementDocumentStatuses
            .Where(s => s.TenantId == _tenant.TenantId && s.IsActive)
            .OrderBy(s => s.SortOrder)
            .Select(s => new PostDisbursementDocumentStatusDto(
                s.DocumentStatusId,
                s.Code,
                s.Label,
                s.SortOrder,
                s.IsActive))
            .ToListAsync(cancellationToken);
    }
}

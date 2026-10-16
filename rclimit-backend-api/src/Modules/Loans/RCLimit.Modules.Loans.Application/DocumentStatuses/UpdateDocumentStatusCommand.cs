using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.DocumentStatuses;

public record UpdateDocumentStatusCommand(Guid DocumentStatusId, string Label, int SortOrder, bool IsActive) : IRequest<PostDisbursementDocumentStatusDto>;

public class UpdateDocumentStatusCommandHandler : IRequestHandler<UpdateDocumentStatusCommand, PostDisbursementDocumentStatusDto>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public UpdateDocumentStatusCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<PostDisbursementDocumentStatusDto> Handle(UpdateDocumentStatusCommand request, CancellationToken cancellationToken)
    {
        var status = await _db.PostDisbursementDocumentStatuses
            .FirstOrDefaultAsync(s => s.DocumentStatusId == request.DocumentStatusId && s.TenantId == _tenant.TenantId, cancellationToken)
            ?? throw new InvalidOperationException($"Document status {request.DocumentStatusId} not found");

        status.Label = request.Label;
        status.SortOrder = request.SortOrder;
        status.IsActive = request.IsActive;

        _db.PostDisbursementDocumentStatuses.Update(status);
        await _db.SaveChangesAsync(cancellationToken);

        return new PostDisbursementDocumentStatusDto(
            status.DocumentStatusId,
            status.Code,
            status.Label,
            status.SortOrder,
            status.IsActive);
    }
}

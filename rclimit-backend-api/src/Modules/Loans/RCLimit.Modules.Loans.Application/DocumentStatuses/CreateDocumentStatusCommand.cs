using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.DocumentStatuses;

public record CreateDocumentStatusCommand(string Code, string Label, int SortOrder) : IRequest<PostDisbursementDocumentStatusDto>;

public class CreateDocumentStatusCommandHandler : IRequestHandler<CreateDocumentStatusCommand, PostDisbursementDocumentStatusDto>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateDocumentStatusCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<PostDisbursementDocumentStatusDto> Handle(CreateDocumentStatusCommand request, CancellationToken cancellationToken)
    {
        var status = new PostDisbursementDocumentStatus
        {
            DocumentStatusId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            Code = request.Code,
            Label = request.Label,
            SortOrder = request.SortOrder,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.PostDisbursementDocumentStatuses.Add(status);
        await _db.SaveChangesAsync(cancellationToken);

        return new PostDisbursementDocumentStatusDto(
            status.DocumentStatusId,
            status.Code,
            status.Label,
            status.SortOrder,
            status.IsActive);
    }
}

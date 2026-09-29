using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

public record UpdateParticularTypeCommand(
    Guid ParticularTypeId,
    string Label,
    int SortOrder,
    bool IsActive) : IRequest<DisbursalParticularTypeDto>;

public class UpdateParticularTypeCommandHandler(ILoansDbContext db)
    : IRequestHandler<UpdateParticularTypeCommand, DisbursalParticularTypeDto>
{
    public async Task<DisbursalParticularTypeDto> Handle(UpdateParticularTypeCommand request, CancellationToken cancellationToken)
    {
        var entity = await db.DisbursalParticularTypes
            .FirstAsync(t => t.ParticularTypeId == request.ParticularTypeId, cancellationToken);

        entity.Label = request.Label;
        entity.SortOrder = request.SortOrder;
        entity.IsActive = request.IsActive;

        await db.SaveChangesAsync(cancellationToken);

        return new DisbursalParticularTypeDto(
            entity.ParticularTypeId, entity.Code, entity.Label, entity.SortOrder, entity.IsActive);
    }
}

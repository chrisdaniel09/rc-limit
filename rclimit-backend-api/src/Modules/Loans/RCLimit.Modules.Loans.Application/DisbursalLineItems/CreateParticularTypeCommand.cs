using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

public record CreateParticularTypeCommand(
    string Code,
    string Label,
    int SortOrder) : IRequest<DisbursalParticularTypeDto>;

public class CreateParticularTypeCommandHandler(ILoansDbContext db, ITenantContext tenant)
    : IRequestHandler<CreateParticularTypeCommand, DisbursalParticularTypeDto>
{
    public async Task<DisbursalParticularTypeDto> Handle(CreateParticularTypeCommand request, CancellationToken cancellationToken)
    {
        var entity = new DisbursalParticularType
        {
            TenantId = tenant.TenantId,
            Code = request.Code,
            Label = request.Label,
            SortOrder = request.SortOrder
        };

        db.DisbursalParticularTypes.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        return new DisbursalParticularTypeDto(
            entity.ParticularTypeId, entity.Code, entity.Label, entity.SortOrder, entity.IsActive);
    }
}

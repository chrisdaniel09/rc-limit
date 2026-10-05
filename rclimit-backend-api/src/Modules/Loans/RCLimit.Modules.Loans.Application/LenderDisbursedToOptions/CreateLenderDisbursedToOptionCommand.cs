using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.LenderDisbursedToOptions;

public record CreateLenderDisbursedToOptionCommand(string Code, string Label, int SortOrder)
    : IRequest<LenderDisbursedToOptionDto>;

public class CreateLenderDisbursedToOptionCommandHandler(ILoansDbContext db, ITenantContext tenant)
    : IRequestHandler<CreateLenderDisbursedToOptionCommand, LenderDisbursedToOptionDto>
{
    public async Task<LenderDisbursedToOptionDto> Handle(CreateLenderDisbursedToOptionCommand request, CancellationToken cancellationToken)
    {
        var option = new LenderDisbursedToOption
        {
            TenantId = tenant.TenantId,
            Code = request.Code,
            Label = request.Label,
            SortOrder = request.SortOrder
        };

        db.LenderDisbursedToOptions.Add(option);
        await db.SaveChangesAsync(cancellationToken);

        return new LenderDisbursedToOptionDto(
            option.OptionId, option.Code, option.Label, option.SortOrder, option.IsActive);
    }
}

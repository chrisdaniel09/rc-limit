using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Partners.Application.Abstractions;
using RCLimit.Modules.Partners.Domain.Entities;

namespace RCLimit.Modules.Partners.Application.Commands;

public record CreatePartnerCommand(
    string PartnerType,
    string LegalName,
    string? PhoneNumber,
    string? Email,
    decimal DefaultCommissionSplitPct = 70.00m) : IRequest<Guid>;

public class CreatePartnerCommandHandler : IRequestHandler<CreatePartnerCommand, Guid>
{
    private readonly IPartnersDbContext _db;
    private readonly ITenantContext _tenant;

    public CreatePartnerCommandHandler(IPartnersDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(CreatePartnerCommand request, CancellationToken cancellationToken)
    {
        var partner = new Partner
        {
            PartnerId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            PartnerType = request.PartnerType,
            LegalName = request.LegalName,
            PhoneNumber = request.PhoneNumber,
            Email = request.Email,
            DefaultCommissionSplitPct = request.DefaultCommissionSplitPct
        };

        _db.Partners.Add(partner);
        await _db.SaveChangesAsync(cancellationToken);
        return partner.PartnerId;
    }
}

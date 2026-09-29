using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Vehicles;

public record GetVehiclesQuery : IRequest<List<VehicleDto>>;

public class GetVehiclesQueryHandler : IRequestHandler<GetVehiclesQuery, List<VehicleDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetVehiclesQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<VehicleDto>> Handle(GetVehiclesQuery request, CancellationToken cancellationToken)
    {
        return await _db.Vehicles
            .Where(v => v.TenantId == _tenant.TenantId)
            .Select(v => new VehicleDto(
                v.VehicleId,
                v.RegistrationNumber,
                v.ChassisNumber,
                v.EngineNumber,
                v.Make,
                v.Model,
                v.Variant,
                v.YearOfMfg,
                v.OwnershipCount,
                v.OwnerCustomerId,
                v.CurrentRtoStatus))
            .ToListAsync(cancellationToken);
    }
}

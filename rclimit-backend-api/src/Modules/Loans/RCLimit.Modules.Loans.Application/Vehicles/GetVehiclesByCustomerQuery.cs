using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Vehicles;

public record GetVehiclesByCustomerQuery(Guid CustomerId) : IRequest<List<VehicleDto>>;

public class GetVehiclesByCustomerQueryHandler : IRequestHandler<GetVehiclesByCustomerQuery, List<VehicleDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetVehiclesByCustomerQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<VehicleDto>> Handle(GetVehiclesByCustomerQuery request, CancellationToken cancellationToken)
    {
        return await _db.Vehicles
            .Where(v => v.TenantId == _tenant.TenantId && v.OwnerCustomerId == request.CustomerId)
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

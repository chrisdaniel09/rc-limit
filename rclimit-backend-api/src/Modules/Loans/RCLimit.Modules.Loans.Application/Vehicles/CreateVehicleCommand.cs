using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Vehicles;

public record CreateVehicleCommand(
    string RegistrationNumber,
    string? ChassisNumber,
    string? EngineNumber,
    string? Make,
    string? Model,
    string? Variant,
    int? YearOfMfg,
    Guid? OwnerCustomerId) : IRequest<Guid>;

public class CreateVehicleCommandHandler : IRequestHandler<CreateVehicleCommand, Guid>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateVehicleCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(CreateVehicleCommand request, CancellationToken cancellationToken)
    {
        var vehicle = new Vehicle
        {
            VehicleId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            RegistrationNumber = request.RegistrationNumber,
            ChassisNumber = request.ChassisNumber,
            EngineNumber = request.EngineNumber,
            Make = request.Make,
            Model = request.Model,
            Variant = request.Variant,
            YearOfMfg = request.YearOfMfg,
            OwnerCustomerId = request.OwnerCustomerId
        };

        _db.Vehicles.Add(vehicle);
        await _db.SaveChangesAsync(cancellationToken);
        return vehicle.VehicleId;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Vehicles;

public record UpdateVehicleCommand(
    Guid VehicleId,
    string RegistrationNumber,
    string? ChassisNumber,
    string? EngineNumber,
    string? Make,
    string? Model,
    string? Variant,
    int? YearOfMfg,
    int OwnershipCount,
    Guid? OwnerCustomerId,
    string CurrentRtoStatus) : IRequest<bool>;

public class UpdateVehicleCommandHandler : IRequestHandler<UpdateVehicleCommand, bool>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public UpdateVehicleCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<bool> Handle(UpdateVehicleCommand request, CancellationToken cancellationToken)
    {
        var vehicle = await _db.Vehicles
            .FirstOrDefaultAsync(v => v.VehicleId == request.VehicleId && v.TenantId == _tenant.TenantId, cancellationToken);

        if (vehicle is null) return false;

        vehicle.RegistrationNumber = request.RegistrationNumber;
        vehicle.ChassisNumber = request.ChassisNumber;
        vehicle.EngineNumber = request.EngineNumber;
        vehicle.Make = request.Make;
        vehicle.Model = request.Model;
        vehicle.Variant = request.Variant;
        vehicle.YearOfMfg = request.YearOfMfg;
        vehicle.OwnershipCount = request.OwnershipCount;
        vehicle.OwnerCustomerId = request.OwnerCustomerId;
        vehicle.CurrentRtoStatus = request.CurrentRtoStatus;
        vehicle.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }
}

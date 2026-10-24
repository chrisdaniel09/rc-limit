using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Contracts.Vehicles;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.ModuleApis;

public sealed class VehiclesModuleApi(ILoansDbContext db, ITenantContext tenant) : IVehiclesModuleApi
{
    private const string OpenLoanStatus = "DISBURSED_RC_PENDING";

    public async Task<Guid?> FindCurrentOwnerIdAsync(string registrationNumber, CancellationToken cancellationToken = default)
    {
        var vehicle = await FindVehicleAsync(registrationNumber, cancellationToken);
        return vehicle?.OwnerCustomerId;
    }

    public async Task<VehicleOwnershipPreviewDto> GetOwnershipPreviewAsync(
        string registrationNumber,
        Guid? selectedCustomerId,
        CancellationToken cancellationToken = default)
    {
        var vehicle = await FindVehicleAsync(registrationNumber, cancellationToken);

        if (vehicle == null)
            return new VehicleOwnershipPreviewDto("NEW", null);

        if (vehicle.OwnerCustomerId == selectedCustomerId)
            return new VehicleOwnershipPreviewDto("SAME_OWNER", null);

        if (vehicle.OwnerCustomerId.HasValue)
        {
            if (await HasOpenLoanAsync(vehicle, cancellationToken))
                return new VehicleOwnershipPreviewDto("BLOCKED", null);

            var ownerName = await db.Customers
                .AsNoTracking()
                .Where(c => c.CustomerId == vehicle.OwnerCustomerId)
                .Select(c => c.LegalName)
                .FirstOrDefaultAsync(cancellationToken);

            return new VehicleOwnershipPreviewDto("OWNED_BY_OTHER", ownerName);
        }

        return new VehicleOwnershipPreviewDto("NONE", null);
    }

    public async Task EnsureAssignableAsync(
        string registrationNumber,
        Guid? customerId,
        bool confirmTransfer,
        CancellationToken cancellationToken = default)
    {
        var vehicle = await FindVehicleAsync(registrationNumber, cancellationToken);
        if (vehicle == null)
            return;

        // Already owned by this customer: nothing to transfer.
        if (customerId.HasValue && vehicle.OwnerCustomerId == customerId)
            return;

        if (!confirmTransfer)
            throw new BusinessRuleException("Vehicle is owned by another customer. Confirm transfer to proceed.");

        if (await HasOpenLoanAsync(vehicle, cancellationToken))
            throw new BusinessRuleException("Cannot transfer vehicle with an open loan.");
    }

    public async Task<Guid> AssignToCustomerAsync(
        string registrationNumber,
        Guid customerId,
        Guid sourceLeadId,
        bool confirmTransfer,
        CancellationToken cancellationToken = default)
    {
        // All rules are checked before anything is written.
        await EnsureAssignableAsync(registrationNumber, customerId, confirmTransfer, cancellationToken);

        var vehicle = await FindVehicleAsync(registrationNumber, cancellationToken);

        if (vehicle == null)
        {
            var newVehicle = new Vehicle
            {
                VehicleId = Guid.NewGuid(),
                TenantId = tenant.TenantId,
                RegistrationNumber = registrationNumber,
                OwnerCustomerId = customerId
            };

            db.Vehicles.Add(newVehicle);
            await db.SaveChangesAsync(cancellationToken);

            db.CustomerVehicles.Add(NewOwnership(customerId, newVehicle.VehicleId, sourceLeadId));
            await db.SaveChangesAsync(cancellationToken);

            return newVehicle.VehicleId;
        }

        if (vehicle.OwnerCustomerId == customerId)
        {
            // Already owned by this customer: link the existing ownership to the lead.
            var existingOwnership = await db.CustomerVehicles
                .FirstOrDefaultAsync(cv => cv.VehicleId == vehicle.VehicleId && cv.OwnedTo == null, cancellationToken);

            if (existingOwnership != null)
            {
                existingOwnership.SourceLeadId = sourceLeadId;
                await db.SaveChangesAsync(cancellationToken);
            }

            return vehicle.VehicleId;
        }

        // Transfer: close the current ownership, then open a new one for the customer.
        var previousOwnership = await db.CustomerVehicles
            .FirstOrDefaultAsync(cv => cv.VehicleId == vehicle.VehicleId && cv.OwnedTo == null, cancellationToken);

        if (previousOwnership != null)
        {
            previousOwnership.OwnedTo = DateTime.UtcNow;
            previousOwnership.EndReason = "TRANSFERRED";
        }

        vehicle.OwnerCustomerId = customerId;
        db.CustomerVehicles.Add(NewOwnership(customerId, vehicle.VehicleId, sourceLeadId));
        await db.SaveChangesAsync(cancellationToken);

        return vehicle.VehicleId;
    }

    public async Task<IReadOnlyDictionary<Guid, int>> GetOpenVehicleCountsAsync(
        IReadOnlyCollection<Guid> customerIds,
        CancellationToken cancellationToken = default)
    {
        if (customerIds.Count == 0)
            return new Dictionary<Guid, int>();

        return await db.CustomerVehicles
            .AsNoTracking()
            .Where(cv => cv.TenantId == tenant.TenantId && customerIds.Contains(cv.CustomerId) && cv.OwnedTo == null)
            .GroupBy(cv => cv.CustomerId)
            .Select(g => new { CustomerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CustomerId, x => x.Count, cancellationToken);
    }

    private async Task<Vehicle?> FindVehicleAsync(string registrationNumber, CancellationToken cancellationToken)
    {
        var normalized = NormalizeRegistrationNumber(registrationNumber);
        return await db.Vehicles
            .FirstOrDefaultAsync(v => v.TenantId == tenant.TenantId && v.RegistrationNumber.ToUpper() == normalized, cancellationToken);
    }

    private Task<bool> HasOpenLoanAsync(Vehicle vehicle, CancellationToken cancellationToken) =>
        db.LoanTransactions
            .AsNoTracking()
            .AnyAsync(lt => lt.VehicleId == vehicle.VehicleId &&
                lt.CustomerId == vehicle.OwnerCustomerId &&
                lt.LoanStatus == OpenLoanStatus, cancellationToken);

    private CustomerVehicle NewOwnership(Guid customerId, Guid vehicleId, Guid sourceLeadId) => new()
    {
        CustomerVehicleId = Guid.NewGuid(),
        TenantId = tenant.TenantId,
        CustomerId = customerId,
        VehicleId = vehicleId,
        SourceLeadId = sourceLeadId,
        OwnedFrom = DateTime.UtcNow,
        OwnedTo = null,
        EndReason = null
    };

    private static string NormalizeRegistrationNumber(string regNo) =>
        Regex.Replace(regNo.ToUpper().Trim(), @"[\s\-]", "");
}

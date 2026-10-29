using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Contracts.Vehicles;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Infrastructure.ModuleApis;

public sealed class VehiclesModuleApi(ILoansDbContext db, ITenantContext tenant) : IVehiclesModuleApi
{
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

    public async Task<IReadOnlyList<VehicleFieldConflictDto>> GetConflictsAsync(
        VehicleDetailsDto incoming,
        CancellationToken cancellationToken = default)
    {
        var vehicle = await FindVehicleAsync(incoming.RegistrationNumber, cancellationToken);
        if (vehicle == null)
            return [];

        return new[]
        {
            Conflict(nameof(VehicleDetailsDto.ChassisNumber), vehicle.ChassisNumber, incoming.ChassisNumber),
            Conflict(nameof(VehicleDetailsDto.EngineNumber), vehicle.EngineNumber, incoming.EngineNumber),
            Conflict(nameof(VehicleDetailsDto.Make), vehicle.Make, incoming.Make),
            Conflict(nameof(VehicleDetailsDto.Model), vehicle.Model, incoming.Model),
            Conflict(nameof(VehicleDetailsDto.Variant), vehicle.Variant, incoming.Variant),
            Conflict(nameof(VehicleDetailsDto.YearOfMfg), vehicle.YearOfMfg?.ToString(), incoming.YearOfMfg?.ToString()),
        }.OfType<VehicleFieldConflictDto>().ToList();
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
        VehicleDetailsDto details,
        Guid customerId,
        Guid sourceLeadId,
        bool confirmTransfer,
        IReadOnlySet<string> overwriteFields,
        CancellationToken cancellationToken = default)
    {
        // All rules are checked before anything is written.
        await EnsureAssignableAsync(details.RegistrationNumber, customerId, confirmTransfer, cancellationToken);

        var vehicle = await FindVehicleAsync(details.RegistrationNumber, cancellationToken);

        if (vehicle == null)
        {
            var newVehicle = new Vehicle
            {
                VehicleId = Guid.NewGuid(),
                TenantId = tenant.TenantId,
                RegistrationNumber = NormalizeRegistrationNumber(details.RegistrationNumber),
                OwnerCustomerId = customerId
            };
            ApplyDetails(newVehicle, details, overwriteFields: null);

            // The vehicle is saved first. The ownership row references it, and EF does not order these inserts for us.
            db.Vehicles.Add(newVehicle);
            await db.SaveChangesAsync(cancellationToken);

            db.CustomerVehicles.Add(NewOwnership(customerId, newVehicle.VehicleId, sourceLeadId));
            await db.SaveChangesAsync(cancellationToken);

            return newVehicle.VehicleId;
        }

        ApplyDetails(vehicle, details, overwriteFields);

        if (vehicle.OwnerCustomerId == customerId)
        {
            // Already owned by this customer: link the existing ownership to the lead.
            var existingOwnership = await db.CustomerVehicles
                .FirstOrDefaultAsync(cv => cv.VehicleId == vehicle.VehicleId && cv.OwnedTo == null, cancellationToken);

            if (existingOwnership != null)
                existingOwnership.SourceLeadId = sourceLeadId;

            await db.SaveChangesAsync(cancellationToken);
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
                LoanStatuses.OpenStatuses.Contains(lt.LoanStatus), cancellationToken);

    // A blank incoming value never changes the vehicle. A held value changes only when its field is in overwriteFields.
    // Passing null overwriteFields applies every incoming value (used for a vehicle created by this call).
    private static void ApplyDetails(Vehicle vehicle, VehicleDetailsDto details, IReadOnlySet<string>? overwriteFields)
    {
        bool ShouldSet(string field, string? current) =>
            overwriteFields is null || string.IsNullOrWhiteSpace(current) || overwriteFields.Contains(field);

        if (!string.IsNullOrWhiteSpace(details.ChassisNumber) && ShouldSet(nameof(VehicleDetailsDto.ChassisNumber), vehicle.ChassisNumber))
            vehicle.ChassisNumber = details.ChassisNumber;
        if (!string.IsNullOrWhiteSpace(details.EngineNumber) && ShouldSet(nameof(VehicleDetailsDto.EngineNumber), vehicle.EngineNumber))
            vehicle.EngineNumber = details.EngineNumber;
        if (!string.IsNullOrWhiteSpace(details.Make) && ShouldSet(nameof(VehicleDetailsDto.Make), vehicle.Make))
            vehicle.Make = details.Make;
        if (!string.IsNullOrWhiteSpace(details.Model) && ShouldSet(nameof(VehicleDetailsDto.Model), vehicle.Model))
            vehicle.Model = details.Model;
        if (!string.IsNullOrWhiteSpace(details.Variant) && ShouldSet(nameof(VehicleDetailsDto.Variant), vehicle.Variant))
            vehicle.Variant = details.Variant;
        if (details.YearOfMfg.HasValue && ShouldSet(nameof(VehicleDetailsDto.YearOfMfg), vehicle.YearOfMfg?.ToString()))
            vehicle.YearOfMfg = details.YearOfMfg;

        vehicle.UpdatedAt = DateTime.UtcNow;
    }

    private static VehicleFieldConflictDto? Conflict(string field, string? current, string? incoming)
    {
        if (string.IsNullOrWhiteSpace(current) || string.IsNullOrWhiteSpace(incoming))
            return null;

        return string.Equals(current.Trim(), incoming.Trim(), StringComparison.OrdinalIgnoreCase)
            ? null
            : new VehicleFieldConflictDto(field, current, incoming);
    }

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

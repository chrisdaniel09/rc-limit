namespace RCLimit.Modules.Loans.Contracts.Vehicles;

// Vehicle ownership rules used when a lead is converted. Mutating calls check every rule before they write.
public interface IVehiclesModuleApi
{
    Task<Guid?> FindCurrentOwnerIdAsync(string registrationNumber, CancellationToken cancellationToken = default);

    Task<VehicleOwnershipPreviewDto> GetOwnershipPreviewAsync(
        string registrationNumber,
        Guid? selectedCustomerId,
        CancellationToken cancellationToken = default);

    // Fields where the incoming value differs from a value already held for the vehicle. Blank fields are not conflicts.
    Task<IReadOnlyList<VehicleFieldConflictDto>> GetConflictsAsync(
        VehicleDetailsDto incoming,
        CancellationToken cancellationToken = default);

    // Throws BusinessRuleException when the vehicle cannot be given to the customer. Writes nothing.
    Task EnsureAssignableAsync(
        string registrationNumber,
        Guid? customerId,
        bool confirmTransfer,
        CancellationToken cancellationToken = default);

    // Applies the details (blank vehicle fields are filled; held values change only for names in overwriteFields)
    // and gives the vehicle to the customer. Field names are the property names of VehicleDetailsDto.
    Task<Guid> AssignToCustomerAsync(
        VehicleDetailsDto details,
        Guid customerId,
        Guid sourceLeadId,
        bool confirmTransfer,
        IReadOnlySet<string> overwriteFields,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, int>> GetOpenVehicleCountsAsync(
        IReadOnlyCollection<Guid> customerIds,
        CancellationToken cancellationToken = default);
}

// Status: NEW | SAME_OWNER | OWNED_BY_OTHER | BLOCKED | NONE
public sealed record VehicleOwnershipPreviewDto(string Status, string? CurrentOwnerName);

public sealed record VehicleDetailsDto(
    string RegistrationNumber,
    string? ChassisNumber,
    string? EngineNumber,
    string? Make,
    string? Model,
    string? Variant,
    int? YearOfMfg);

// Field is the VehicleDetailsDto property name. CurrentValue is the value the vehicle already holds.
public sealed record VehicleFieldConflictDto(string Field, string? CurrentValue, string? IncomingValue);

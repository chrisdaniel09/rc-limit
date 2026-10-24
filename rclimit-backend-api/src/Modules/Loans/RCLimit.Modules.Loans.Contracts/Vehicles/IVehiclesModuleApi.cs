namespace RCLimit.Modules.Loans.Contracts.Vehicles;

// Vehicle ownership rules used when a lead is converted. Mutating calls check every rule before they write.
public interface IVehiclesModuleApi
{
    Task<Guid?> FindCurrentOwnerIdAsync(string registrationNumber, CancellationToken cancellationToken = default);

    Task<VehicleOwnershipPreviewDto> GetOwnershipPreviewAsync(
        string registrationNumber,
        Guid? selectedCustomerId,
        CancellationToken cancellationToken = default);

    // Throws BusinessRuleException when the vehicle cannot be given to the customer. Writes nothing.
    Task EnsureAssignableAsync(
        string registrationNumber,
        Guid? customerId,
        bool confirmTransfer,
        CancellationToken cancellationToken = default);

    Task<Guid> AssignToCustomerAsync(
        string registrationNumber,
        Guid customerId,
        Guid sourceLeadId,
        bool confirmTransfer,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, int>> GetOpenVehicleCountsAsync(
        IReadOnlyCollection<Guid> customerIds,
        CancellationToken cancellationToken = default);
}

// Status: NEW | SAME_OWNER | OWNED_BY_OTHER | BLOCKED | NONE
public sealed record VehicleOwnershipPreviewDto(string Status, string? CurrentOwnerName);

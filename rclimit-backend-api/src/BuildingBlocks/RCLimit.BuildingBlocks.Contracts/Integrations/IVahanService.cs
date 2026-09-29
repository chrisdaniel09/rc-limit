namespace RCLimit.BuildingBlocks.Contracts.Integrations;

public interface IVahanService
{
    Task<VahanResponse> CheckVehicleAsync(string registrationNumber, CancellationToken cancellationToken = default);
}

public record VahanResponse(
    string RegistrationNumber,
    string OwnerName,
    string VehicleClass,
    string FuelType,
    string MakerModel,
    string RtoStatus,
    bool IsBlacklisted,
    bool HasActiveChallan,
    string? ExistingHypothecation);

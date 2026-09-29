namespace RCLimit.Modules.Loans.Application.Vehicles;

public record VehicleDto(
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
    string CurrentRtoStatus);

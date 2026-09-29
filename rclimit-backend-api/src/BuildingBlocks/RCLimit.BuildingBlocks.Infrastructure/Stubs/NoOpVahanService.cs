using Microsoft.Extensions.Logging;
using RCLimit.BuildingBlocks.Contracts.Integrations;

namespace RCLimit.BuildingBlocks.Infrastructure.Stubs;

public class NoOpVahanService : IVahanService
{
    private readonly ILogger<NoOpVahanService> _logger;

    public NoOpVahanService(ILogger<NoOpVahanService> logger)
    {
        _logger = logger;
    }

    public Task<VahanResponse> CheckVehicleAsync(string registrationNumber, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Vahan Stub] Checking vehicle: {RegNo}", registrationNumber);

        var response = new VahanResponse(
            RegistrationNumber: registrationNumber,
            OwnerName: "Stub Owner",
            VehicleClass: "COMMERCIAL",
            FuelType: "DIESEL",
            MakerModel: "Tata Prima",
            RtoStatus: "CLEAN",
            IsBlacklisted: false,
            HasActiveChallan: false,
            ExistingHypothecation: null);

        return Task.FromResult(response);
    }
}

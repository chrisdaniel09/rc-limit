using Microsoft.Extensions.Logging;
using RCLimit.BuildingBlocks.Contracts.Integrations;

namespace RCLimit.BuildingBlocks.Infrastructure.Stubs;

public class NoOpWhatsAppService : IWhatsAppService
{
    private readonly ILogger<NoOpWhatsAppService> _logger;

    public NoOpWhatsAppService(ILogger<NoOpWhatsAppService> logger)
    {
        _logger = logger;
    }

    public Task SendMessageAsync(string phone, string message, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[WhatsApp Stub] To: {Phone}, Message: {Message}", phone, message);
        return Task.CompletedTask;
    }
}

namespace RCLimit.BuildingBlocks.Contracts.Integrations;

public interface IWhatsAppService
{
    Task SendMessageAsync(string phone, string message, CancellationToken cancellationToken = default);
}

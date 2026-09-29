using MediatR;

namespace RCLimit.BuildingBlocks.Contracts.IntegrationEvents;

public record UserRegisteredEvent(
    Guid UserId,
    Guid TenantId,
    string Email,
    string FullName) : INotification;

using MediatR;

namespace RCLimit.BuildingBlocks.Contracts.IntegrationEvents;

public record LoanDisbursedEvent(
    Guid LoanId,
    Guid TenantId,
    Guid CustomerId,
    Guid VehicleId,
    decimal SanctionedAmount,
    decimal NetDisbursedAmount,
    DateTime DisbursalDate) : INotification;

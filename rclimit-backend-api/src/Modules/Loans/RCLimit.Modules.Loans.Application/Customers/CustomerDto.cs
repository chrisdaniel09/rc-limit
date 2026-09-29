namespace RCLimit.Modules.Loans.Application.Customers;

public record CustomerDto(
    Guid CustomerId,
    string CustomerType,
    string LegalName,
    string? TradeName,
    string? PhoneNumber,
    int? CibilScore,
    string? CibilTier,
    string RiskStatus,
    decimal AssignedCeiling,
    decimal CurrentUtilization,
    decimal AvailableSubLimit,
    int PendingRcCount,
    int MaxPendingRcAllowed,
    bool StopSupplyFlag);

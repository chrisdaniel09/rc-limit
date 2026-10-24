namespace RCLimit.Modules.Loans.Contracts.Customers;

public sealed record CustomerSummaryDto(
    Guid CustomerId,
    string LegalName,
    string? TradeName,
    string? PhoneNumber);

public sealed record CreateCustomerFromLeadRequest(
    string CustomerType,
    decimal AssignedCeiling,
    int MaxPendingRcAllowed,
    string LegalName,
    string? PhoneNumber,
    int? CibilScore);

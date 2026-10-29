namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

public record DisbursalLineItemDto(
    Guid LineItemId,
    Guid LoanId,
    DateOnly EntryDate,
    string EntryDirection,
    string Counterparty,
    string ParticularType,
    string? ModeOfPayment,
    string? BankName,
    string? AccountNo,
    string? TransactionId,
    decimal Amount,
    decimal RunningBalanceAmt);

namespace RCLimit.Modules.Accounting.Application.Dtos;

public record BalanceSheetDto(
    List<BalanceSheetGroupDto> Assets,
    List<BalanceSheetGroupDto> Liabilities,
    List<BalanceSheetGroupDto> Equity,
    List<BalanceSheetGroupDto> Income,
    List<BalanceSheetGroupDto> Expenses,
    decimal TotalAssets,
    decimal TotalLiabilities,
    decimal TotalEquity,
    decimal TotalIncome,
    decimal TotalExpenses,
    decimal NetBalance);

public record BalanceSheetGroupDto(
    Guid AccountId,
    string AccountCode,
    string AccountName,
    decimal DebitTotal,
    decimal CreditTotal,
    decimal Balance);

namespace RCLimit.Modules.Loans.Domain.Rules;

// Ledger entries (spec section 4). The Anna Finance balance is the running balance after the latest entry.
public static class LedgerRules
{
    public const string Credit = "CREDIT";
    public const string Debit = "DEBIT";

    public const string AnnaFinance = "ANNA_FINANCE";
    public const string Customer = "CUSTOMER";

    // Particular type used for every credit. The posting rule for it already exists.
    public const string BankDisbursalParticularType = "BANK_DISBURSAL";

    public static bool IsValidDirection(string direction) => direction is Credit or Debit;

    // A bank credit straight to the customer. It is hidden by the ledger toggle (C1).
    public static bool IsDirectCustomerCredit(string direction, string counterparty) =>
        direction == Credit && counterparty == Customer;

    // The balance after an entry. A credit to the customer leaves the Anna Finance balance unchanged.
    public static decimal Apply(decimal balance, string direction, string counterparty, decimal amount)
    {
        if (direction == Credit)
            return counterparty == AnnaFinance ? balance + amount : balance;

        return balance - amount;
    }
}

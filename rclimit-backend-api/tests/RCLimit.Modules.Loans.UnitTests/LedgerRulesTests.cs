using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.UnitTests;

public class LedgerRulesTests
{
    [Fact]
    public void Credit_to_Anna_Finance_adds_to_the_balance()
    {
        Assert.Equal(1_500_000m, LedgerRules.Apply(0m, LedgerRules.Credit, LedgerRules.AnnaFinance, 1_500_000m));
    }

    [Fact]
    public void Credit_to_the_customer_leaves_the_balance_unchanged()
    {
        Assert.Equal(200m, LedgerRules.Apply(200m, LedgerRules.Credit, LedgerRules.Customer, 50m));
    }

    [Fact]
    public void Every_debit_reduces_the_balance_including_customer_payouts()
    {
        Assert.Equal(150m, LedgerRules.Apply(200m, LedgerRules.Debit, LedgerRules.Customer, 50m));
        Assert.Equal(150m, LedgerRules.Apply(200m, LedgerRules.Debit, LedgerRules.AnnaFinance, 50m));
    }

    [Fact]
    public void Spec_example_settles_to_zero()
    {
        // Spec section 4.C: one credit, then four deductions that clear the balance.
        var balance = LedgerRules.Apply(0m, LedgerRules.Credit, LedgerRules.AnnaFinance, 1_500_000m);
        foreach (var debit in new[] { 10_000m, 10_000m, 5_000m, 1_475_000m })
            balance = LedgerRules.Apply(balance, LedgerRules.Debit, LedgerRules.Customer, debit);

        Assert.Equal(0m, balance);
    }

    [Fact]
    public void Multiple_credits_to_Anna_Finance_accumulate()
    {
        var balance = LedgerRules.Apply(0m, LedgerRules.Credit, LedgerRules.AnnaFinance, 1_000m);
        balance = LedgerRules.Apply(balance, LedgerRules.Credit, LedgerRules.AnnaFinance, 500m);

        Assert.Equal(1_500m, balance);
    }

    [Theory]
    [InlineData(LedgerRules.Credit, LedgerRules.Customer, true)]
    [InlineData(LedgerRules.Credit, LedgerRules.AnnaFinance, false)]
    [InlineData(LedgerRules.Debit, LedgerRules.Customer, false)]
    public void Only_bank_credits_to_the_customer_are_direct_customer_credits(string direction, string counterparty, bool expected)
    {
        Assert.Equal(expected, LedgerRules.IsDirectCustomerCredit(direction, counterparty));
    }

    [Theory]
    [InlineData("CREDIT", true)]
    [InlineData("DEBIT", true)]
    [InlineData("credit", false)]
    [InlineData("", false)]
    public void Direction_must_be_credit_or_debit(string direction, bool expected)
    {
        Assert.Equal(expected, LedgerRules.IsValidDirection(direction));
    }
}

public class SubLimitRulesTests
{
    [Fact]
    public void Amount_within_headroom_is_allowed()
    {
        var subLimit = new CustomerSubLimit { AssignedCeiling = 1_000m, CurrentUtilization = 400m };
        Assert.Null(SubLimitRules.HeadroomViolation(subLimit, 600m));
    }

    [Fact]
    public void Amount_over_headroom_is_refused()
    {
        var subLimit = new CustomerSubLimit { AssignedCeiling = 1_000m, CurrentUtilization = 400m };
        Assert.Equal("Loan amount exceeds available sub-limit.", SubLimitRules.HeadroomViolation(subLimit, 600.01m));
    }

    [Fact]
    public void Stop_supply_refuses_any_amount()
    {
        var subLimit = new CustomerSubLimit { AssignedCeiling = 1_000m, StopSupplyFlag = true };
        Assert.NotNull(SubLimitRules.HeadroomViolation(subLimit, 1m));
    }
}

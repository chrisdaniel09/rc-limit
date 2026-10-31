using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.UnitTests;

public class RcAgingRulesTests
{
    private static readonly DateOnly Today = new(2026, 10, 30);

    [Theory]
    [InlineData(0, RcAgingRules.OnTime)]
    [InlineData(30, RcAgingRules.OnTime)]
    [InlineData(31, RcAgingRules.Warning)]
    [InlineData(44, RcAgingRules.Warning)]
    [InlineData(45, RcAgingRules.Overdue)]
    public void Status_follows_the_30_and_44_day_bands(int days, string expected)
    {
        Assert.Equal(expected, RcAgingRules.Status(days));
    }

    [Theory]
    [InlineData(RcAgingRules.OnTime)]
    [InlineData(RcAgingRules.Warning)]
    [InlineData(RcAgingRules.Overdue)]
    public void Disbursal_range_contains_exactly_the_dates_in_that_band(string status)
    {
        var range = RcAgingRules.DisbursalRange(status, Today)!.Value;
        for (var days = 0; days <= 90; days++)
        {
            var disbursed = Today.AddDays(-days);
            var inRange = (range.From is null || disbursed >= range.From) && (range.To is null || disbursed <= range.To);
            Assert.Equal(RcAgingRules.Status(RcAgingRules.AgingDays(disbursed, Today)) == status, inRange);
        }
    }
}

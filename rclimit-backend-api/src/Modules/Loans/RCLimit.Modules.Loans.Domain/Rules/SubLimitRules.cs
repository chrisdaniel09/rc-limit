using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Domain.Rules;

public static class SubLimitRules
{
    // Returns why the customer cannot take this amount, or null when the amount fits.
    // Checked at sanction and again at disbursal, because other loans may have used the headroom in between.
    public static string? HeadroomViolation(CustomerSubLimit subLimit, decimal amount)
    {
        if (subLimit.StopSupplyFlag)
            return "Stop-supply is active for this dealer. No new disbursals allowed.";

        if (subLimit.CurrentUtilization + amount > subLimit.AssignedCeiling)
            return "Loan amount exceeds available sub-limit.";

        return null;
    }
}

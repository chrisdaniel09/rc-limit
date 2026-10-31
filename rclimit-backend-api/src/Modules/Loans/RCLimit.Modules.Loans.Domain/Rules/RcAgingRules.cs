namespace RCLimit.Modules.Loans.Domain.Rules;

// The RC clock runs from disbursal until the loan is closed: on time up to 30 days, a warning to 44, then overdue (locked).
public static class RcAgingRules
{
    public const string OnTime = "ON_TIME";
    public const string Warning = "WARNING_ZONE";
    public const string Overdue = "OVERDUE_LOCK";

    public const int OnTimeDays = 30;
    public const int WarningDays = 44;

    public static int AgingDays(DateOnly disbursalDate, DateOnly today) => today.DayNumber - disbursalDate.DayNumber;

    public static string Status(int agingDays) => agingDays switch
    {
        <= OnTimeDays => OnTime,
        <= WarningDays => Warning,
        _ => Overdue,
    };

    // Disbursal dates that put a loan in the given band today, as an inclusive range (null = open-ended).
    public static (DateOnly? From, DateOnly? To)? DisbursalRange(string status, DateOnly today) => status switch
    {
        OnTime => (today.AddDays(-OnTimeDays), null),
        Warning => (today.AddDays(-WarningDays), today.AddDays(-(OnTimeDays + 1))),
        Overdue => (null, today.AddDays(-(WarningDays + 1))),
        _ => null,
    };
}

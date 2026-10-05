namespace RCLimit.Modules.Loans.Domain.ValueObjects;

public static class LeadStatuses
{
    public const string New = "NEW";
    public const string InProgress = "IN_PROGRESS";
    public const string Qualified = "QUALIFIED";
    public const string Converted = "CONVERTED";
    public const string Rejected = "REJECTED";
}

public static class CheckStatuses
{
    public const string NotStarted = "NOT_STARTED";
    public const string InProgress = "IN_PROGRESS";
    public const string Passed = "PASSED";
    public const string Failed = "FAILED";
}

public static class CheckTypes
{
    public const string Cibil = "CIBIL";
    public const string Rc = "RC";
}

public static class CheckSources
{
    public const string Manual = "MANUAL";
    public const string VahanApi = "VAHAN";
    public const string CibilApi = "CIBIL_API";
}

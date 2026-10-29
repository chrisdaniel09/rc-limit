namespace RCLimit.Modules.Loans.Domain.Rules;

// The loan file state machine (spec section 3). Terminal states allow no further moves.
public static class LoanStatuses
{
    public const string New = "NEW";
    public const string DocumentsPending = "DOCUMENTS_PENDING";
    public const string LoggedIn = "LOGGED_IN";
    public const string CreditReview = "CREDIT_REVIEW";
    public const string Sanctioned = "SANCTIONED";
    public const string Rejected = "REJECTED";
    public const string Withdrawn = "WITHDRAWN";
    public const string Disbursed = "DISBURSED";
    public const string Closed = "CLOSED";

    private static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        [New] = [DocumentsPending, LoggedIn, Withdrawn],
        [DocumentsPending] = [LoggedIn, Withdrawn],
        [LoggedIn] = [CreditReview, Rejected, Withdrawn],
        [CreditReview] = [Sanctioned, Rejected, Withdrawn],
        [Sanctioned] = [Disbursed, Rejected, Withdrawn],
        [Disbursed] = [Closed],
    };

    // Reached through their own endpoints, because they carry data and change the sub-limit.
    private static readonly HashSet<string> DedicatedTargets = [Sanctioned, Disbursed];

    private static readonly HashSet<string> TerminalStatuses = [Rejected, Withdrawn, Closed];

    // A vehicle with a loan in any of these states cannot change owner.
    public static readonly string[] OpenStatuses =
        [New, DocumentsPending, LoggedIn, CreditReview, Sanctioned, Disbursed];

    public static bool CanMove(string from, string to) =>
        Transitions.TryGetValue(from, out var next) && next.Contains(to);

    public static IReadOnlyList<string> NextStatuses(string from) =>
        Transitions.TryGetValue(from, out var next) ? next : [];

    public static bool RequiresDedicatedEndpoint(string to) => DedicatedTargets.Contains(to);

    public static bool IsTerminal(string status) => TerminalStatuses.Contains(status);
}

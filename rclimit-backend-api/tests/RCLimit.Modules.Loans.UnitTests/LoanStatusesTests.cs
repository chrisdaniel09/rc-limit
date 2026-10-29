using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.UnitTests;

public class LoanStatusesTests
{
    [Theory]
    [InlineData(LoanStatuses.New, LoanStatuses.DocumentsPending)]
    [InlineData(LoanStatuses.New, LoanStatuses.LoggedIn)]
    [InlineData(LoanStatuses.DocumentsPending, LoanStatuses.LoggedIn)]
    [InlineData(LoanStatuses.LoggedIn, LoanStatuses.CreditReview)]
    [InlineData(LoanStatuses.CreditReview, LoanStatuses.Sanctioned)]
    [InlineData(LoanStatuses.Sanctioned, LoanStatuses.Disbursed)]
    [InlineData(LoanStatuses.Disbursed, LoanStatuses.Closed)]
    [InlineData(LoanStatuses.Sanctioned, LoanStatuses.Withdrawn)]
    [InlineData(LoanStatuses.CreditReview, LoanStatuses.Rejected)]
    public void Allowed_moves_follow_the_state_matrix(string from, string to)
    {
        Assert.True(LoanStatuses.CanMove(from, to));
    }

    [Theory]
    [InlineData(LoanStatuses.New, LoanStatuses.Sanctioned)]
    [InlineData(LoanStatuses.New, LoanStatuses.Disbursed)]
    [InlineData(LoanStatuses.LoggedIn, LoanStatuses.Sanctioned)]
    [InlineData(LoanStatuses.New, LoanStatuses.Rejected)]
    [InlineData(LoanStatuses.Disbursed, LoanStatuses.Withdrawn)]
    [InlineData(LoanStatuses.Disbursed, LoanStatuses.Sanctioned)]
    public void Skipping_or_reversing_a_stage_is_refused(string from, string to)
    {
        Assert.False(LoanStatuses.CanMove(from, to));
    }

    [Theory]
    [InlineData(LoanStatuses.Rejected)]
    [InlineData(LoanStatuses.Withdrawn)]
    [InlineData(LoanStatuses.Closed)]
    public void Terminal_states_have_no_next_state(string status)
    {
        Assert.True(LoanStatuses.IsTerminal(status));
        Assert.Empty(LoanStatuses.NextStatuses(status));
        Assert.DoesNotContain(status, LoanStatuses.OpenStatuses);
    }

    [Fact]
    public void Sanction_and_disbursal_need_their_own_actions()
    {
        Assert.True(LoanStatuses.RequiresDedicatedEndpoint(LoanStatuses.Sanctioned));
        Assert.True(LoanStatuses.RequiresDedicatedEndpoint(LoanStatuses.Disbursed));
        Assert.False(LoanStatuses.RequiresDedicatedEndpoint(LoanStatuses.Closed));
    }
}

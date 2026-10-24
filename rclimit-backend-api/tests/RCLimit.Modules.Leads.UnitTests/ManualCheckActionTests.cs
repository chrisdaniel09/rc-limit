using System.Text.Json;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;
using RCLimit.Modules.Leads.Infrastructure.Actions;

namespace RCLimit.Modules.Leads.UnitTests;

public class ManualCheckActionTests
{
    private static ActionContext Context(object? request) => new(
        new Lead(),
        new Dictionary<string, JsonElement>(),
        request is null ? null : JsonSerializer.SerializeToElement(request),
        Guid.NewGuid());

    [Fact]
    public async Task Cibil_records_outcome_score_and_remarks()
    {
        var action = new CibilCheckAction();

        var outcome = await action.ExecuteAsync(
            Context(new { outcome = CheckStatuses.Passed, score = 745, remarks = "bureau ok" }),
            CancellationToken.None);

        Assert.Equal(ActionStatuses.Succeeded, outcome.Status);
        Assert.Null(outcome.Error);
        Assert.Equal(CheckStatuses.Passed, outcome.Response!.Value.GetProperty("outcome").GetString());
        Assert.Equal(745, outcome.Response.Value.GetProperty("score").GetInt32());
        Assert.Equal("bureau ok", outcome.Response.Value.GetProperty("remarks").GetString());
    }

    [Fact]
    public async Task Cibil_accepts_an_outcome_without_a_score()
    {
        var action = new CibilCheckAction();

        var outcome = await action.ExecuteAsync(
            Context(new { outcome = CheckStatuses.InProgress }), CancellationToken.None);

        Assert.Equal(ActionStatuses.Succeeded, outcome.Status);
        Assert.Equal(JsonValueKind.Null, outcome.Response!.Value.GetProperty("score").ValueKind);
    }

    [Theory]
    [InlineData(299)]
    [InlineData(901)]
    public async Task Cibil_rejects_a_score_outside_300_to_900(int score)
    {
        var action = new CibilCheckAction();

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            action.ExecuteAsync(Context(new { outcome = CheckStatuses.Passed, score }), CancellationToken.None));
    }

    [Theory]
    [InlineData(300)]
    [InlineData(900)]
    public async Task Cibil_accepts_the_boundary_scores(int score)
    {
        var action = new CibilCheckAction();

        var outcome = await action.ExecuteAsync(
            Context(new { outcome = CheckStatuses.Passed, score }), CancellationToken.None);

        Assert.Equal(score, outcome.Response!.Value.GetProperty("score").GetInt32());
    }

    [Fact]
    public async Task Vahan_rejects_a_score_because_the_check_takes_none()
    {
        var action = new VahanCheckAction();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            action.ExecuteAsync(Context(new { outcome = CheckStatuses.Passed, score = 700 }), CancellationToken.None));
        Assert.Contains("does not take a score", ex.Message);
    }

    [Fact]
    public async Task Vahan_accepts_an_outcome_without_a_score()
    {
        var action = new VahanCheckAction();

        var outcome = await action.ExecuteAsync(
            Context(new { outcome = CheckStatuses.Failed, remarks = "blacklisted" }), CancellationToken.None);

        Assert.Equal(CheckStatuses.Failed, outcome.Response!.Value.GetProperty("outcome").GetString());
        Assert.Equal("blacklisted", outcome.Response.Value.GetProperty("remarks").GetString());
    }

    [Theory]
    [InlineData("NOT_STARTED")]
    [InlineData("PENDING")]
    [InlineData("")]
    public async Task Rejects_an_outcome_that_is_not_allowed(string outcomeValue)
    {
        var action = new VahanCheckAction();

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            action.ExecuteAsync(Context(new { outcome = outcomeValue }), CancellationToken.None));
    }

    [Fact]
    public async Task Rejects_a_request_with_no_outcome()
    {
        var action = new CibilCheckAction();

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            action.ExecuteAsync(Context(new { score = 700 }), CancellationToken.None));
    }

    [Fact]
    public async Task Rejects_a_missing_request()
    {
        var action = new CibilCheckAction();

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            action.ExecuteAsync(Context(null), CancellationToken.None));
    }
}

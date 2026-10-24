using System.Text.Json;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.Actions;

// One implementation per action code. The executor resolves it by code and never knows what it does.
public interface IAction
{
    Task<ActionOutcome> ExecuteAsync(ActionContext context, CancellationToken cancellationToken);
}

public sealed record ActionContext(
    Lead Lead,
    Dictionary<string, JsonElement> Config,
    JsonElement? Request,
    Guid PerformedByUserId);

// Lifecycle status is Succeeded or Failed. Domain outcomes (PASSED, a score) go in Response.
public sealed record ActionOutcome(string Status, JsonElement? Response, string? Error)
{
    public static ActionOutcome Succeeded(JsonElement response) =>
        new(ActionStatuses.Succeeded, response, null);

    public static ActionOutcome Failed(string error) =>
        new(ActionStatuses.Failed, null, error);
}

public static class ActionStatuses
{
    public const string Succeeded = "SUCCEEDED";
    public const string Failed = "FAILED";
}

public static class ActionCodes
{
    public const string CibilCheck = "CIBIL_CHECK";
    public const string VahanCheck = "VAHAN_CHECK";
}

public static class ActionOutcomes
{
    public static readonly string[] Allowed =
    [
        CheckStatuses.Passed,
        CheckStatuses.Failed,
        CheckStatuses.InProgress
    ];
}

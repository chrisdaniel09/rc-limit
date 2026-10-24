using System.Text.Json;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Actions;

namespace RCLimit.Modules.Leads.Infrastructure.Actions;

// Records an outcome that a user entered by hand. The request carries outcome, optional score and remarks.
// Subclasses decide whether a score is allowed and in what range.
public abstract class ManualCheckAction(bool allowScore, int minScore = 0, int maxScore = 0) : IAction
{
    // Payloads are stored as camelCase JSON, matching the request keys.
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Task<ActionOutcome> ExecuteAsync(ActionContext context, CancellationToken cancellationToken)
    {
        if (context.Request is not { ValueKind: JsonValueKind.Object } request)
            throw new BusinessRuleException("A check needs an outcome.");

        var outcome = request.TryGetProperty("outcome", out var outcomeValue) && outcomeValue.ValueKind == JsonValueKind.String
            ? outcomeValue.GetString()
            : null;

        if (outcome is null || !ActionOutcomes.Allowed.Contains(outcome))
            throw new BusinessRuleException($"Outcome must be one of: {string.Join(", ", ActionOutcomes.Allowed)}.");

        int? score = null;
        if (request.TryGetProperty("score", out var scoreValue) && scoreValue.ValueKind != JsonValueKind.Null)
        {
            if (!allowScore)
                throw new BusinessRuleException("This check does not take a score.");
            if (!scoreValue.TryGetInt32(out var value) || value < minScore || value > maxScore)
                throw new BusinessRuleException($"Score must be between {minScore} and {maxScore}.");
            score = value;
        }

        string? remarks = request.TryGetProperty("remarks", out var remarksValue) && remarksValue.ValueKind == JsonValueKind.String
            ? remarksValue.GetString()
            : null;

        var response = JsonSerializer.SerializeToElement(new ManualCheckResult(outcome, score, remarks), JsonOptions);
        return Task.FromResult(ActionOutcome.Succeeded(response));
    }
}

public sealed record ManualCheckResult(string Outcome, int? Score, string? Remarks);

public sealed class CibilCheckAction() : ManualCheckAction(allowScore: true, minScore: 300, maxScore: 900);

public sealed class VahanCheckAction() : ManualCheckAction(allowScore: false);

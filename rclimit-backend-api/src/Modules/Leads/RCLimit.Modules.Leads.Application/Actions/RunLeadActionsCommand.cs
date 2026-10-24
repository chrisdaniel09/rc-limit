using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Actions;

// Requests maps an action code to the payload that action receives. Actions with no entry get no request.
public record RunLeadActionsCommand(
    Guid LeadId,
    Dictionary<string, JsonElement>? Requests) : IRequest<List<ActionExecutionDto>>;

public record ActionExecutionDto(
    Guid ExecutionId,
    string ActionCode,
    int? ActionOrder,
    string Status,
    JsonElement? Response,
    string? Error,
    DateTime StartedAt,
    DateTime? CompletedAt);

// Runs the lead's product type actions in order. Every run is recorded, including failures.
// Stops at the first failed run, so later actions do not run on a result that was not produced.
public class RunLeadActionsCommandHandler(ILeadsDbContext db, ITenantContext tenant, IActionRegistry registry)
    : IRequestHandler<RunLeadActionsCommand, List<ActionExecutionDto>>
{
    public async Task<List<ActionExecutionDto>> Handle(RunLeadActionsCommand request, CancellationToken cancellationToken)
    {
        var lead = await db.Leads.FirstOrDefaultAsync(
            l => l.LeadId == request.LeadId && l.TenantId == tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.ConvertedCustomerId.HasValue || lead.LeadStatus == "CONVERTED")
            throw new BusinessRuleException("Cannot run actions for a converted lead.");

        var productType = await db.ProductTypes.FirstOrDefaultAsync(
            p => p.TenantId == tenant.TenantId && p.Code == lead.ProductTypeCode, cancellationToken)
            ?? throw new BusinessRuleException($"Product type '{lead.ProductTypeCode}' was not found.");

        var requests = request.Requests ?? new Dictionary<string, JsonElement>();
        var configured = productType.Actions.Select(a => a.Code).ToHashSet(StringComparer.Ordinal);

        var unknown = requests.Keys.Where(code => !configured.Contains(code)).ToList();
        if (unknown.Count > 0)
            throw new BusinessRuleException(
                $"These actions are not configured for '{lead.ProductTypeCode}': {string.Join(", ", unknown)}.");

        if (requests.Count == 0)
            throw new BusinessRuleException("Choose at least one action to run.");

        var results = new List<ActionExecutionDto>();

        // Only the actions named in the request run, in their configured order. Others are left alone.
        foreach (var definition in productType.Actions.OrderBy(a => a.Order).Where(a => requests.ContainsKey(a.Code)))
        {
            requests.TryGetValue(definition.Code, out var payload);

            var execution = new ActionExecution
            {
                ExecutionId = Guid.NewGuid(),
                TenantId = tenant.TenantId,
                LeadId = lead.LeadId,
                ProductTypeCode = lead.ProductTypeCode,
                ActionCode = definition.Code,
                ActionOrder = definition.Order,
                Source = "MANUAL",
                RequestPayload = requests.ContainsKey(definition.Code) ? payload : null,
                PerformedByUserId = tenant.UserId,
                StartedAt = DateTime.UtcNow
            };

            try
            {
                var action = registry.Resolve(definition.Code);
                var outcome = await action.ExecuteAsync(
                    new ActionContext(lead, definition.Config, execution.RequestPayload, tenant.UserId),
                    cancellationToken);

                execution.Status = outcome.Status;
                execution.ResponsePayload = outcome.Response;
                execution.ErrorMessage = outcome.Error;
            }
            catch (BusinessRuleException ex)
            {
                // Bad input for this action. Record it as a failed run rather than losing the attempt.
                execution.Status = ActionStatuses.Failed;
                execution.ErrorMessage = ex.Message;
            }

            execution.CompletedAt = DateTime.UtcNow;
            db.ActionExecutions.Add(execution);
            await db.SaveChangesAsync(cancellationToken);

            results.Add(new ActionExecutionDto(
                execution.ExecutionId,
                execution.ActionCode,
                execution.ActionOrder,
                execution.Status,
                execution.ResponsePayload,
                execution.ErrorMessage,
                execution.StartedAt,
                execution.CompletedAt));

            if (execution.Status == ActionStatuses.Failed)
                break;
        }

        return results;
    }
}

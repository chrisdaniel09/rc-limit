using System.Text.Json;

namespace RCLimit.Modules.Leads.Domain.Entities;

// One run of an action for a lead. Append-only: a retry is a new row.
// Status is the run lifecycle only. Domain outcomes live in ResponsePayload.
public class ActionExecution
{
    public Guid ExecutionId { get; set; }
    public Guid TenantId { get; set; }
    public Guid LeadId { get; set; }
    public string ProductTypeCode { get; set; } = string.Empty;
    public string ActionCode { get; set; } = string.Empty;
    public int? ActionOrder { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Source { get; set; } = "MANUAL";
    public JsonElement? RequestPayload { get; set; }
    public JsonElement? ResponsePayload { get; set; }
    public string? ErrorMessage { get; set; }
    public Guid? PerformedByUserId { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}

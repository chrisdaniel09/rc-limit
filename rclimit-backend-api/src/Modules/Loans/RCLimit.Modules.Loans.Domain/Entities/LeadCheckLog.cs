namespace RCLimit.Modules.Loans.Domain.Entities;

public class LeadCheckLog
{
    public Guid LogId { get; set; }
    public Guid TenantId { get; set; }
    public Guid LeadId { get; set; }
    public string CheckType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? Score { get; set; }
    public string? Remarks { get; set; }
    public string Source { get; set; } = "MANUAL";
    public Guid PerformedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

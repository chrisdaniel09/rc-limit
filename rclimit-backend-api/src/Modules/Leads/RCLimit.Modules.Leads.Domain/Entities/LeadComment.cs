namespace RCLimit.Modules.Leads.Domain.Entities;

public class LeadComment
{
    public Guid CommentId { get; set; }
    public Guid TenantId { get; set; }
    public Guid LeadId { get; set; }
    public string CommentText { get; set; } = null!;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

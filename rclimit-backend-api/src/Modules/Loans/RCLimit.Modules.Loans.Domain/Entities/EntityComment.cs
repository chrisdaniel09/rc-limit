namespace RCLimit.Modules.Loans.Domain.Entities;

public class EntityComment
{
    public Guid CommentId { get; set; }
    public Guid TenantId { get; set; }
    public string EntityType { get; set; } = null!;
    public Guid EntityId { get; set; }
    public string CommentText { get; set; } = null!;
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

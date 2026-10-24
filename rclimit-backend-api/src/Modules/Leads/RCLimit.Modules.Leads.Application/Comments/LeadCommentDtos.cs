namespace RCLimit.Modules.Leads.Application.Comments;

public record LeadCommentDto(
    Guid CommentId,
    string CommentText,
    Guid CreatedByUserId,
    string? CreatedByUserName,
    DateTime CreatedAt);

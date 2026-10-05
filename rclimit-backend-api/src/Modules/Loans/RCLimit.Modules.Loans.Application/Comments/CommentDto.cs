namespace RCLimit.Modules.Loans.Application.Comments;

public record CommentDto(
    Guid CommentId,
    string CommentText,
    Guid CreatedByUserId,
    string? CreatedByUserName,
    DateTime CreatedAt);

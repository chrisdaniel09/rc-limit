namespace RCLimit.Modules.Identity.Domain.Entities;

public class Right
{
    public Guid RightId { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

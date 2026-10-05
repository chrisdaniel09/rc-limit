namespace RCLimit.Modules.Identity.Domain.Entities;

public class Role
{
    public Guid RoleId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystem { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<RoleRight> RoleRights { get; set; } = new List<RoleRight>();
}

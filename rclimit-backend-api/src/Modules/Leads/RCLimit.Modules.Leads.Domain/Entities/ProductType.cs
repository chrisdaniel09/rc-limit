using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Domain.Entities;

public class ProductType
{
    public Guid ProductTypeId { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public List<ProductFieldDefinition> FieldSchema { get; set; } = new();
    public List<ActionDefinition> Actions { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

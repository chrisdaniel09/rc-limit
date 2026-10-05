namespace RCLimit.Modules.Loans.Domain.Entities;

public class LenderDisbursedToOption
{
    public Guid OptionId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public bool AllowsDisbursalLineItems { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

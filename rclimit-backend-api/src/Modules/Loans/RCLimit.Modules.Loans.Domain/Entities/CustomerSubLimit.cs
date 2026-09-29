namespace RCLimit.Modules.Loans.Domain.Entities;

public class CustomerSubLimit
{
    public Guid SubLimitId { get; set; }
    public Guid CustomerId { get; set; }
    public decimal AssignedCeiling { get; set; }
    public decimal CurrentUtilization { get; set; }
    public int PendingRcCount { get; set; }
    public int MaxPendingRcAllowed { get; set; } = 5;
    public bool StopSupplyFlag { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Customer Customer { get; set; } = null!;
}

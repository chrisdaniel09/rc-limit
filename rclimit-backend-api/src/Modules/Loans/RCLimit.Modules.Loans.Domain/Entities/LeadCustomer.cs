namespace RCLimit.Modules.Loans.Domain.Entities;

public class LeadCustomer
{
    public Guid LeadCustomerId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid LeadId { get; set; }
    public Guid CustomerId { get; set; }
    public string LinkType { get; set; } = "CREATED"; // CREATED | LINKED_EXISTING
    public string? MatchBasis { get; set; } // PHONE | NAME | MANUAL (populated only when LINKED_EXISTING)
    public Guid? LinkedByUserId { get; set; }
    public DateTime LinkedAt { get; set; } = DateTime.UtcNow;
}

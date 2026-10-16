namespace RCLimit.Modules.Loans.Domain.Entities;

public class CustomerVehicle
{
    public Guid CustomerVehicleId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid VehicleId { get; set; }
    public Guid? SourceLeadId { get; set; }
    public DateTime OwnedFrom { get; set; } = DateTime.UtcNow;
    public DateTime? OwnedTo { get; set; }
    public string? EndReason { get; set; } // TRANSFERRED | SOLD (null means currently owned)
}

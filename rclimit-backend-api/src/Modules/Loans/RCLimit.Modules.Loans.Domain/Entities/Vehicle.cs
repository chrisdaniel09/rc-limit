namespace RCLimit.Modules.Loans.Domain.Entities;

public class Vehicle
{
    public Guid VehicleId { get; set; }
    public Guid TenantId { get; set; }
    public string RegistrationNumber { get; set; } = string.Empty;
    public string? ChassisNumber { get; set; }
    public string? EngineNumber { get; set; }
    public string? Make { get; set; }
    public string? Model { get; set; }
    public string? Variant { get; set; }
    public int? YearOfMfg { get; set; }
    public int OwnershipCount { get; set; } = 1;
    public Guid? OwnerCustomerId { get; set; }
    public string CurrentRtoStatus { get; set; } = "CLEAN";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Customer? OwnerCustomer { get; set; }
}

namespace RCLimit.Modules.Loans.Domain.Entities;

public class VerificationLog
{
    public Guid VerificationId { get; set; }
    public Guid TenantId { get; set; }
    public Guid? VehicleId { get; set; }
    public Guid? CustomerId { get; set; }
    public string VerificationType { get; set; } = string.Empty;
    public string? RequestPayload { get; set; }
    public string? ResponsePayload { get; set; }
    public string ResultStatus { get; set; } = "PENDING";
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
}

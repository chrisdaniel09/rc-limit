namespace RCLimit.Modules.Loans.Domain.Entities;

public class Lead
{
    public Guid LeadId { get; set; }
    public Guid TenantId { get; set; }
    public string LeadSource { get; set; } = "WALK_IN";
    public Guid? PartnerId { get; set; }
    public Guid? ReferredByUserId { get; set; }
    public string WhatsappPhoneNumber { get; set; } = string.Empty;
    public string? ContactPhone { get; set; }
    public string? ApplicantName { get; set; }
    public decimal? RequestedLoanAmount { get; set; }
    public string? VehicleRegistrationNumber { get; set; }
    public string VahanValidationStatus { get; set; } = "PENDING";
    public int? CibilScorePreview { get; set; }
    public string LeadStatus { get; set; } = "INBOUND_INCOMPLETE";
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

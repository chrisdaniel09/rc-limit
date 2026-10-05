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
    public string LeadStatus { get; set; } = "NEW";
    public string? Notes { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public DateTime? AssignedAt { get; set; }
    public string CibilCheckStatus { get; set; } = "NOT_STARTED";
    public DateTime? CibilCheckedAt { get; set; }
    public string RcCheckStatus { get; set; } = "NOT_STARTED";
    public DateTime? RcCheckedAt { get; set; }
    public Guid? ConvertedCustomerId { get; set; }
    public DateTime? ConvertedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

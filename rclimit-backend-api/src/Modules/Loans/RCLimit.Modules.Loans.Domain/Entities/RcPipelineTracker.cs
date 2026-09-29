namespace RCLimit.Modules.Loans.Domain.Entities;

public class RcPipelineTracker
{
    public Guid TrackerId { get; set; }
    public Guid LoanId { get; set; }
    public string CurrentStage { get; set; } = "DISBURSED_PENDING_RTO";
    public string AgingStatus { get; set; } = "ON_TIME";
    public string? RtoAckDocUrl { get; set; }
    public string? FinalRcDocUrl { get; set; }
    public DateTime? AckUploadedAt { get; set; }
    public DateTime? RcClearedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public LoanTransaction LoanTransaction { get; set; } = null!;
}

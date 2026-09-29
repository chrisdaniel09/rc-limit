using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class RcPipelineTrackerConfiguration : IEntityTypeConfiguration<RcPipelineTracker>
{
    public void Configure(EntityTypeBuilder<RcPipelineTracker> builder)
    {
        builder.ToTable("rc_pipeline_tracker");
        builder.HasKey(e => e.TrackerId);
        builder.Property(e => e.TrackerId).HasColumnName("tracker_id");
        builder.Property(e => e.LoanId).HasColumnName("loan_id");
        builder.Property(e => e.CurrentStage).HasColumnName("current_stage").HasMaxLength(50);
        builder.Property(e => e.AgingStatus).HasColumnName("aging_status").HasMaxLength(20);
        builder.Property(e => e.RtoAckDocUrl).HasColumnName("rto_ack_doc_url").HasMaxLength(255);
        builder.Property(e => e.FinalRcDocUrl).HasColumnName("final_rc_doc_url").HasMaxLength(255);
        builder.Property(e => e.AckUploadedAt).HasColumnName("ack_uploaded_at");
        builder.Property(e => e.RcClearedAt).HasColumnName("rc_cleared_at");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
    }
}

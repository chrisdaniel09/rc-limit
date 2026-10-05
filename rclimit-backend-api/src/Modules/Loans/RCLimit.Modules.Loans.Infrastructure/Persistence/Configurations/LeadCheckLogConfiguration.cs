using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class LeadCheckLogConfiguration : IEntityTypeConfiguration<LeadCheckLog>
{
    public void Configure(EntityTypeBuilder<LeadCheckLog> builder)
    {
        builder.ToTable("lead_check_logs");
        builder.HasKey(e => e.LogId);
        builder.Property(e => e.LogId).HasColumnName("log_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.LeadId).HasColumnName("lead_id");
        builder.Property(e => e.CheckType).HasColumnName("check_type").HasMaxLength(20);
        builder.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
        builder.Property(e => e.Score).HasColumnName("score");
        builder.Property(e => e.Remarks).HasColumnName("remarks");
        builder.Property(e => e.Source).HasColumnName("source").HasMaxLength(20);
        builder.Property(e => e.PerformedByUserId).HasColumnName("performed_by_user_id");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(e => e.LeadId);
        builder.HasIndex(e => e.TenantId);
    }
}

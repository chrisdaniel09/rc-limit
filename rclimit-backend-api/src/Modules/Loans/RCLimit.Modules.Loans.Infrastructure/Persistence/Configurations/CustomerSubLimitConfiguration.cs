using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class CustomerSubLimitConfiguration : IEntityTypeConfiguration<CustomerSubLimit>
{
    public void Configure(EntityTypeBuilder<CustomerSubLimit> builder)
    {
        builder.ToTable("customer_sub_limits");
        builder.HasKey(e => e.SubLimitId);
        builder.Property(e => e.SubLimitId).HasColumnName("sub_limit_id");
        builder.Property(e => e.CustomerId).HasColumnName("customer_id");
        builder.Property(e => e.AssignedCeiling).HasColumnName("assigned_ceiling");
        builder.Property(e => e.CurrentUtilization).HasColumnName("current_utilization");
        builder.Property(e => e.PendingRcCount).HasColumnName("pending_rc_count");
        builder.Property(e => e.MaxPendingRcAllowed).HasColumnName("max_pending_rc_allowed");
        builder.Property(e => e.StopSupplyFlag).HasColumnName("stop_supply_flag");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
    }
}

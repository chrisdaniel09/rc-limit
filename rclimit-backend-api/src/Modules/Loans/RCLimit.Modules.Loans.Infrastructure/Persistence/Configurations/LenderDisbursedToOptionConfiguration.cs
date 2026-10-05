using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class LenderDisbursedToOptionConfiguration : IEntityTypeConfiguration<LenderDisbursedToOption>
{
    public void Configure(EntityTypeBuilder<LenderDisbursedToOption> builder)
    {
        builder.ToTable("lender_disbursed_to_options");
        builder.HasKey(e => e.OptionId);
        builder.Property(e => e.OptionId).HasColumnName("option_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.Code).HasColumnName("code").HasMaxLength(50);
        builder.Property(e => e.Label).HasColumnName("label").HasMaxLength(100);
        builder.Property(e => e.SortOrder).HasColumnName("sort_order");
        builder.Property(e => e.IsActive).HasColumnName("is_active");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Partners.Domain.Entities;

namespace RCLimit.Modules.Partners.Infrastructure.Persistence.Configurations;

public class PartnerConfiguration : IEntityTypeConfiguration<Partner>
{
    public void Configure(EntityTypeBuilder<Partner> builder)
    {
        builder.ToTable("partners");
        builder.HasKey(e => e.PartnerId);
        builder.Property(e => e.PartnerId).HasColumnName("partner_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.PartnerType).HasColumnName("partner_type").HasMaxLength(30);
        builder.Property(e => e.LegalName).HasColumnName("legal_name").HasMaxLength(150);
        builder.Property(e => e.PhoneNumber).HasColumnName("phone_number").HasMaxLength(20);
        builder.Property(e => e.Email).HasColumnName("email").HasMaxLength(255);
        builder.Property(e => e.DefaultCommissionSplitPct).HasColumnName("default_commission_split_pct");
        builder.Property(e => e.Status).HasColumnName("status").HasMaxLength(30);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
    }
}

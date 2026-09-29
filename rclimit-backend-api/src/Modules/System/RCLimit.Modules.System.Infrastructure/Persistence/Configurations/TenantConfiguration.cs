using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.System.Domain.Entities;

namespace RCLimit.Modules.System.Infrastructure.Persistence.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants", "system");
        builder.HasKey(e => e.TenantId);
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.OrganizationName).HasColumnName("organization_name").HasMaxLength(150).IsRequired();
        builder.Property(e => e.Slug).HasColumnName("slug").HasMaxLength(50).IsRequired();
        builder.Property(e => e.CustomDomain).HasColumnName("custom_domain").HasMaxLength(150);
        builder.Property(e => e.SubscriptionPlan).HasColumnName("subscription_plan").HasMaxLength(30).HasDefaultValue("ENTERPRISE");
        builder.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(e => e.DatabaseConnectionString).HasColumnName("database_connection_string");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(e => e.Slug).IsUnique();
        builder.HasIndex(e => e.CustomDomain).IsUnique();

        builder.HasOne(e => e.Settings)
            .WithOne(e => e.Tenant)
            .HasForeignKey<TenantSettings>(e => e.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

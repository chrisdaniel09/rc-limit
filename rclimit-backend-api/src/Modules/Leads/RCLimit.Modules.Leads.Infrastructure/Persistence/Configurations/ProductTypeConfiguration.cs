using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Infrastructure.Persistence.Configurations;

public class ProductTypeConfiguration : IEntityTypeConfiguration<ProductType>
{
    public void Configure(EntityTypeBuilder<ProductType> builder)
    {
        builder.ToTable("product_types", "leads");
        builder.HasKey(e => e.ProductTypeId);
        builder.Property(e => e.ProductTypeId).HasColumnName("product_type_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.Code).HasColumnName("code").HasMaxLength(30);
        builder.Property(e => e.Label).HasColumnName("label").HasMaxLength(100);
        builder.Property(e => e.SortOrder).HasColumnName("sort_order");
        builder.Property(e => e.IsActive).HasColumnName("is_active");
        builder.Property(e => e.FieldSchema)
            .HasJsonColumn("field_schema")
            .HasColumnType("jsonb");
        builder.Property(e => e.Actions)
            .HasJsonColumn("actions");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(e => new { e.TenantId, e.Code }).IsUnique();
    }
}

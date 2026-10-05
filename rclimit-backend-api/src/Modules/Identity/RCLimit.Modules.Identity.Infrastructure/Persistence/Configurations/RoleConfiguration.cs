using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("roles");
        builder.HasKey(r => r.RoleId);

        builder.Property(r => r.RoleId).HasColumnName("role_id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(r => r.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
        builder.Property(r => r.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(r => r.Description).HasColumnName("description");
        builder.Property(r => r.IsSystem).HasColumnName("is_system").IsRequired();
        builder.Property(r => r.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(r => new { r.TenantId, r.Code }).IsUnique();
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Persistence.Configurations;

public class RightConfiguration : IEntityTypeConfiguration<Right>
{
    public void Configure(EntityTypeBuilder<Right> builder)
    {
        builder.ToTable("rights");
        builder.HasKey(r => r.RightId);

        builder.Property(r => r.RightId).HasColumnName("right_id");
        builder.Property(r => r.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
        builder.Property(r => r.Module).HasColumnName("module").HasMaxLength(50).IsRequired();
        builder.Property(r => r.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(r => r.Description).HasColumnName("description");
        builder.Property(r => r.IsActive).HasColumnName("is_active").IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasIndex(r => r.Code).IsUnique();
    }
}

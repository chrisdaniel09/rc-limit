using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Persistence.Configurations;

public class UserIdentityConfiguration : IEntityTypeConfiguration<UserIdentity>
{
    public void Configure(EntityTypeBuilder<UserIdentity> builder)
    {
        builder.ToTable("user_identities", "auth");
        builder.HasKey(i => i.IdentityId);
        builder.Property(i => i.IdentityId).HasColumnName("identity_id");
        builder.Property(i => i.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(i => i.ProviderType).HasColumnName("provider_type").HasMaxLength(50).IsRequired();
        builder.Property(i => i.ProviderUserId).HasColumnName("provider_user_id").HasMaxLength(255).IsRequired();
        builder.Property(i => i.IdentityData).HasColumnName("identity_data").HasColumnType("jsonb");
        builder.Property(i => i.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(i => new { i.ProviderType, i.ProviderUserId }).IsUnique();
    }
}

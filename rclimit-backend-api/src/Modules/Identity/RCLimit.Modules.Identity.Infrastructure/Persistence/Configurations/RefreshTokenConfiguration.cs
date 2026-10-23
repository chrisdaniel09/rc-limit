using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Persistence.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens", "auth");
        builder.HasKey(r => r.TokenId);
        builder.Property(r => r.TokenId).HasColumnName("token_id");
        builder.Property(r => r.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(r => r.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(r => r.FamilyId).HasColumnName("family_id").IsRequired();
        builder.Property(r => r.TokenHash).HasColumnName("token_hash").HasMaxLength(255).IsRequired();
        builder.Property(r => r.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
        builder.Property(r => r.UserAgent).HasColumnName("user_agent").HasMaxLength(512);
        builder.Property(r => r.SessionStartedAt).HasColumnName("session_started_at").IsRequired();
        builder.Property(r => r.ExpiresAt).HasColumnName("expires_at").IsRequired();
        builder.Property(r => r.IsRevoked).HasColumnName("is_revoked").HasDefaultValue(false);
        builder.Property(r => r.RevokedAt).HasColumnName("revoked_at");
        builder.Property(r => r.RevokedReason).HasColumnName("revoked_reason").HasMaxLength(30);
        builder.Property(r => r.ReplacedByTokenId).HasColumnName("replaced_by_token_id");
        builder.Property(r => r.LastUsedAt).HasColumnName("last_used_at");
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");

        // Optimistic concurrency on PostgreSQL's xmin: a concurrent rotation of the same row fails with
        // DbUpdateConcurrencyException, which the refresh handler maps to 409.
        builder.Property<uint>("xmin")
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        builder.HasIndex(r => r.UserId);
        builder.HasIndex(r => r.FamilyId);
        builder.HasIndex(r => r.TokenHash).IsUnique();
    }
}

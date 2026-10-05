using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class EntityCommentConfiguration : IEntityTypeConfiguration<EntityComment>
{
    public void Configure(EntityTypeBuilder<EntityComment> builder)
    {
        builder.ToTable("entity_comments");

        builder.HasKey(c => c.CommentId);

        builder.Property(c => c.CommentId)
            .HasColumnName("comment_id");

        builder.Property(c => c.TenantId)
            .HasColumnName("tenant_id");

        builder.Property(c => c.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(c => c.EntityId)
            .HasColumnName("entity_id");

        builder.Property(c => c.CommentText)
            .HasColumnName("comment_text")
            .IsRequired();

        builder.Property(c => c.CreatedByUserId)
            .HasColumnName("created_by_user_id");

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at");

        builder.HasIndex(c => new { c.TenantId, c.EntityType, c.EntityId, c.CreatedAt })
            .HasDatabaseName("idx_entity_comments_entity");
    }
}

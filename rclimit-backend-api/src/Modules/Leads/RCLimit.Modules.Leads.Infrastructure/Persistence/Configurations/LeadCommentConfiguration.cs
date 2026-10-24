using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Infrastructure.Persistence.Configurations;

public class LeadCommentConfiguration : IEntityTypeConfiguration<LeadComment>
{
    public void Configure(EntityTypeBuilder<LeadComment> builder)
    {
        builder.ToTable("lead_comments", "leads");

        builder.HasKey(c => c.CommentId);

        builder.Property(c => c.CommentId).HasColumnName("comment_id");
        builder.Property(c => c.TenantId).HasColumnName("tenant_id");
        builder.Property(c => c.LeadId).HasColumnName("lead_id");
        builder.Property(c => c.CommentText).HasColumnName("comment_text").IsRequired();
        builder.Property(c => c.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(c => c.CreatedAt).HasColumnName("created_at");

        builder.HasIndex(c => new { c.TenantId, c.LeadId, c.CreatedAt })
            .HasDatabaseName("idx_lead_comments_lead");
    }
}

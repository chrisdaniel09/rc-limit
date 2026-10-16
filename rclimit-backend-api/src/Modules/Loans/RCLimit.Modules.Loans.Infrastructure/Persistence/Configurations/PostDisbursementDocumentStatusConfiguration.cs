using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class PostDisbursementDocumentStatusConfiguration : IEntityTypeConfiguration<PostDisbursementDocumentStatus>
{
    public void Configure(EntityTypeBuilder<PostDisbursementDocumentStatus> builder)
    {
        builder.ToTable("post_disbursement_document_statuses");

        builder.HasKey(x => x.DocumentStatusId);

        builder.Property(x => x.DocumentStatusId)
            .HasColumnName("document_status_id");

        builder.Property(x => x.TenantId)
            .HasColumnName("tenant_id");

        builder.Property(x => x.Code)
            .HasColumnName("code")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.Label)
            .HasColumnName("label")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.SortOrder)
            .HasColumnName("sort_order");

        builder.Property(x => x.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at");

        builder.HasIndex(x => new { x.TenantId, x.Code })
            .IsUnique()
            .HasDatabaseName("uk_document_status_code");

        builder.HasIndex(x => new { x.TenantId, x.IsActive })
            .HasDatabaseName("idx_document_status_active");

        builder.HasIndex(x => x.TenantId)
            .HasDatabaseName("idx_document_status_tenant");
    }
}

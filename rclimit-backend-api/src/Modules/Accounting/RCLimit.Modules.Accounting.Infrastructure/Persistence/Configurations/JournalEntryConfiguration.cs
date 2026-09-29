using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Infrastructure.Persistence.Configurations;

public class JournalEntryConfiguration : IEntityTypeConfiguration<JournalEntry>
{
    public void Configure(EntityTypeBuilder<JournalEntry> builder)
    {
        builder.ToTable("journal_entries", "accounting");
        builder.HasKey(e => e.JournalId);
        builder.Property(e => e.JournalId).HasColumnName("journal_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.EntryNumber).HasColumnName("entry_number").ValueGeneratedOnAdd();
        builder.Property(e => e.EntryDate).HasColumnName("entry_date");
        builder.Property(e => e.ReferenceId).HasColumnName("reference_id").IsRequired();
        builder.Property(e => e.TransactionType).HasColumnName("transaction_type").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Narration).HasColumnName("narration").IsRequired();
        builder.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
        builder.Property(e => e.PostedByRole).HasColumnName("posted_by_role").HasMaxLength(50).IsRequired();
        builder.Property(e => e.SourceModule).HasColumnName("source_module").HasMaxLength(50).IsRequired();
        builder.Property(e => e.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
        builder.Property(e => e.UserAgent).HasColumnName("user_agent");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");

        builder.HasMany(e => e.LineItems)
            .WithOne(e => e.JournalEntry)
            .HasForeignKey(e => e.JournalId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => e.TenantId);
        builder.HasIndex(e => e.ReferenceId);
    }
}

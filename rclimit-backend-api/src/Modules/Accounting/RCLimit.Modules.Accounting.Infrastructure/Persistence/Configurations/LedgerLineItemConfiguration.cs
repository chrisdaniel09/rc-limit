using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Infrastructure.Persistence.Configurations;

public class LedgerLineItemConfiguration : IEntityTypeConfiguration<LedgerLineItem>
{
    public void Configure(EntityTypeBuilder<LedgerLineItem> builder)
    {
        builder.ToTable("ledger_line_items", "accounting");
        builder.HasKey(e => e.LineItemId);
        builder.Property(e => e.LineItemId).HasColumnName("line_item_id");
        builder.Property(e => e.JournalId).HasColumnName("journal_id").IsRequired();
        builder.Property(e => e.AccountId).HasColumnName("account_id").IsRequired();
        builder.Property(e => e.EntryDirection).HasColumnName("entry_direction").HasMaxLength(10).IsRequired();
        builder.Property(e => e.Amount).HasColumnName("amount").HasPrecision(15, 2).IsRequired();
        builder.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");

        builder.HasOne(e => e.LedgerAccount)
            .WithMany()
            .HasForeignKey(e => e.AccountId);

        builder.HasIndex(e => e.JournalId);
        builder.HasIndex(e => e.AccountId);
    }
}

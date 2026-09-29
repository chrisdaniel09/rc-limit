using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Infrastructure.Persistence.Configurations;

public class LedgerAccountConfiguration : IEntityTypeConfiguration<LedgerAccount>
{
    public void Configure(EntityTypeBuilder<LedgerAccount> builder)
    {
        builder.ToTable("ledger_accounts", "accounting");
        builder.HasKey(e => e.AccountId);
        builder.Property(e => e.AccountId).HasColumnName("account_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.AccountCode).HasColumnName("account_code").HasMaxLength(50).IsRequired();
        builder.Property(e => e.AccountName).HasColumnName("account_name").HasMaxLength(150).IsRequired();
        builder.Property(e => e.AccountType).HasColumnName("account_type").HasMaxLength(30).IsRequired();
        builder.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(3).HasDefaultValue("INR");
        builder.Property(e => e.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(e => e.CreatedByUserId).HasColumnName("created_by_user_id").IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedByUserId).HasColumnName("updated_by_user_id");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        builder.HasIndex(e => new { e.TenantId, e.AccountCode }).IsUnique();
    }
}

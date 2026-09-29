using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Infrastructure.Persistence.Configurations;

public class PostingRuleConfiguration : IEntityTypeConfiguration<PostingRule>
{
    public void Configure(EntityTypeBuilder<PostingRule> builder)
    {
        builder.ToTable("posting_rules");
        builder.HasKey(r => r.RuleId);
        builder.Property(r => r.RuleId).HasColumnName("rule_id");
        builder.Property(r => r.TenantId).HasColumnName("tenant_id");
        builder.Property(r => r.ParticularType).HasColumnName("particular_type").HasMaxLength(50);
        builder.Property(r => r.DebitAccountId).HasColumnName("debit_account_id");
        builder.Property(r => r.CreditAccountId).HasColumnName("credit_account_id");
        builder.Property(r => r.TransactionType).HasColumnName("transaction_type").HasMaxLength(50);
        builder.Property(r => r.Description).HasColumnName("description").HasMaxLength(200);
        builder.Property(r => r.IsActive).HasColumnName("is_active");
        builder.Property(r => r.CreatedAt).HasColumnName("created_at");
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne(r => r.DebitAccount).WithMany().HasForeignKey(r => r.DebitAccountId);
        builder.HasOne(r => r.CreditAccount).WithMany().HasForeignKey(r => r.CreditAccountId);

        builder.HasIndex(r => new { r.TenantId, r.ParticularType }).IsUnique();
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class LenderConfiguration : IEntityTypeConfiguration<Lender>
{
    public void Configure(EntityTypeBuilder<Lender> builder)
    {
        builder.ToTable("lenders");
        builder.HasKey(e => e.LenderId);
        builder.Property(e => e.LenderId).HasColumnName("lender_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(100);
        builder.Property(e => e.Code).HasColumnName("code").HasMaxLength(20);
        builder.Property(e => e.BaseInterestRate).HasColumnName("base_interest_rate");
        builder.Property(e => e.DefaultTenureLimitDays).HasColumnName("default_tenure_limit_days");
        builder.Property(e => e.ContactPersonDetails).HasColumnName("contact_person_details").HasColumnType("jsonb");
        builder.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");

        builder.HasMany(e => e.MasterBankPools).WithOne(e => e.Lender).HasForeignKey(e => e.LenderId);
    }
}

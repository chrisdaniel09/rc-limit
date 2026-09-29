using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class MasterBankPoolConfiguration : IEntityTypeConfiguration<MasterBankPool>
{
    public void Configure(EntityTypeBuilder<MasterBankPool> builder)
    {
        builder.ToTable("master_bank_pools");
        builder.HasKey(e => e.PoolId);
        builder.Property(e => e.PoolId).HasColumnName("pool_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.LenderId).HasColumnName("lender_id");
        builder.Property(e => e.FacilityAccountNumber).HasColumnName("facility_account_number").HasMaxLength(50);
        builder.Property(e => e.SanctionedLimit).HasColumnName("sanctioned_limit");
        builder.Property(e => e.UtilizedAmount).HasColumnName("utilized_amount");
        builder.Property(e => e.SanctionDate).HasColumnName("sanction_date");
        builder.Property(e => e.ExpiryDate).HasColumnName("expiry_date");
        builder.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
    }
}

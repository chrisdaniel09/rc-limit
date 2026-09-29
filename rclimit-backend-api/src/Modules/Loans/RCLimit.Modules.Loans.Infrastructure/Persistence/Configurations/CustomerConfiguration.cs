using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers");
        builder.HasKey(e => e.CustomerId);
        builder.Property(e => e.CustomerId).HasColumnName("customer_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.CustomerType).HasColumnName("customer_type").HasMaxLength(20);
        builder.Property(e => e.LegalName).HasColumnName("legal_name").HasMaxLength(150);
        builder.Property(e => e.TradeName).HasColumnName("trade_name").HasMaxLength(150);
        builder.Property(e => e.PhoneNumber).HasColumnName("phone_number").HasMaxLength(20);
        builder.Property(e => e.Email).HasColumnName("email").HasMaxLength(255);
        builder.Property(e => e.PanNumber).HasColumnName("pan_number").HasMaxLength(20);
        builder.Property(e => e.Gstin).HasColumnName("gstin").HasMaxLength(20);
        builder.Property(e => e.CibilScore).HasColumnName("cibil_score");
        builder.Property(e => e.CibilTier).HasColumnName("cibil_tier").HasMaxLength(10);
        builder.Property(e => e.KycStatus).HasColumnName("kyc_status").HasMaxLength(20);
        builder.Property(e => e.RiskStatus).HasColumnName("risk_status").HasMaxLength(30);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne(e => e.SubLimit).WithOne(e => e.Customer).HasForeignKey<CustomerSubLimit>(e => e.CustomerId);
    }
}

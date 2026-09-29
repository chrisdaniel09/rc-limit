using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class LoanTransactionConfiguration : IEntityTypeConfiguration<LoanTransaction>
{
    public void Configure(EntityTypeBuilder<LoanTransaction> builder)
    {
        builder.ToTable("loan_transactions");
        builder.HasKey(e => e.LoanId);
        builder.Property(e => e.LoanId).HasColumnName("loan_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.SerialNumber).HasColumnName("serial_number").ValueGeneratedOnAdd();
        builder.Property(e => e.LoanNumber).HasColumnName("loan_number").HasMaxLength(30);
        builder.Property(e => e.LenderAgreementNumber).HasColumnName("lender_agreement_number").HasMaxLength(50);
        builder.Property(e => e.CustomerId).HasColumnName("customer_id");
        builder.Property(e => e.VehicleId).HasColumnName("vehicle_id");
        builder.Property(e => e.PoolId).HasColumnName("pool_id");
        builder.Property(e => e.PartnerId).HasColumnName("partner_id");
        builder.Property(e => e.ProductType).HasColumnName("product_type").HasMaxLength(30);
        builder.Property(e => e.SanctionedAmount).HasColumnName("sanctioned_amount");
        builder.Property(e => e.NetDisbursedAmount).HasColumnName("net_disbursed_amount");
        builder.Property(e => e.CustomerRate).HasColumnName("customer_rate");
        builder.Property(e => e.BankPayoutPctAmt).HasColumnName("bank_payout_pct_amt");
        builder.Property(e => e.BonusPayoutAmt).HasColumnName("bonus_payout_amt");
        builder.Property(e => e.SharedPayoutAmt).HasColumnName("shared_payout_amt");
        builder.Property(e => e.TotalPayoutEarned).HasColumnName("total_payout_earned")
            .ValueGeneratedOnAddOrUpdate();
        builder.Property(e => e.LoanStatus).HasColumnName("loan_status").HasMaxLength(30);
        builder.Property(e => e.DisbursalDate).HasColumnName("disbursal_date");
        builder.Property(e => e.Remarks).HasColumnName("remarks");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne(e => e.Customer).WithMany().HasForeignKey(e => e.CustomerId);
        builder.HasOne(e => e.Vehicle).WithMany().HasForeignKey(e => e.VehicleId);
        builder.HasOne(e => e.Pool).WithMany().HasForeignKey(e => e.PoolId);
        builder.HasMany(e => e.DisbursalLineItems).WithOne(e => e.LoanTransaction).HasForeignKey(e => e.LoanId);
        builder.HasOne(e => e.RcTracker).WithOne(e => e.LoanTransaction).HasForeignKey<RcPipelineTracker>(e => e.LoanId);
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class DisbursalLineItemConfiguration : IEntityTypeConfiguration<DisbursalLineItem>
{
    public void Configure(EntityTypeBuilder<DisbursalLineItem> builder)
    {
        builder.ToTable("disbursal_line_items");
        builder.HasKey(e => e.LineItemId);
        builder.Property(e => e.LineItemId).HasColumnName("line_item_id");
        builder.Property(e => e.LoanId).HasColumnName("loan_id");
        builder.Property(e => e.EntryDate).HasColumnName("entry_date");
        builder.Property(e => e.ParticularType).HasColumnName("particular_type").HasMaxLength(50);
        builder.Property(e => e.ModeOfPayment).HasColumnName("mode_of_payment").HasMaxLength(20);
        builder.Property(e => e.BankName).HasColumnName("bank_name").HasMaxLength(100);
        builder.Property(e => e.AccountNo).HasColumnName("account_no").HasMaxLength(50);
        builder.Property(e => e.TransactionId).HasColumnName("transaction_id").HasMaxLength(100);
        builder.Property(e => e.DebitAmount).HasColumnName("debit_amount");
        builder.Property(e => e.RunningBalanceAmt).HasColumnName("running_balance_amt");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
    }
}

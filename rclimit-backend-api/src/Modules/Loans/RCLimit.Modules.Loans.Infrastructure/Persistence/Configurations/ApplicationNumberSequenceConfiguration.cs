using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class ApplicationNumberSequenceConfiguration : IEntityTypeConfiguration<ApplicationNumberSequence>
{
    public void Configure(EntityTypeBuilder<ApplicationNumberSequence> builder)
    {
        builder.ToTable("application_number_sequences", LoansDbContext.Schema);
        builder.HasKey(e => e.TenantId);
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.NextValue).HasColumnName("next_value");
        builder.Property(e => e.Version).IsRowVersion();
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Infrastructure.Persistence.Configurations;

public class LeadCustomerConfiguration : IEntityTypeConfiguration<LeadCustomer>
{
    public void Configure(EntityTypeBuilder<LeadCustomer> builder)
    {
        builder.ToTable("lead_customers", "leads");

        builder.HasKey(x => x.LeadCustomerId);

        builder.Property(x => x.LeadCustomerId)
            .HasColumnName("lead_customer_id");

        builder.Property(x => x.TenantId)
            .HasColumnName("tenant_id");

        builder.Property(x => x.LeadId)
            .HasColumnName("lead_id");

        builder.Property(x => x.CustomerId)
            .HasColumnName("customer_id");

        builder.Property(x => x.LinkType)
            .HasColumnName("link_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.MatchBasis)
            .HasColumnName("match_basis")
            .HasMaxLength(50);

        builder.Property(x => x.LinkedByUserId)
            .HasColumnName("linked_by_user_id");

        builder.Property(x => x.LinkedAt)
            .HasColumnName("linked_at");

        builder.HasIndex(x => x.TenantId)
            .HasDatabaseName("idx_lead_customers_tenant");

        builder.HasIndex(x => x.CustomerId)
            .HasDatabaseName("idx_lead_customers_customer");

        builder.HasIndex(x => new { x.TenantId, x.LinkedAt })
            .HasDatabaseName("idx_lead_customers_linked_at")
            .IsDescending(false, true);
    }
}

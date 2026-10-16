using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class CustomerVehicleConfiguration : IEntityTypeConfiguration<CustomerVehicle>
{
    public void Configure(EntityTypeBuilder<CustomerVehicle> builder)
    {
        builder.ToTable("customer_vehicles");

        builder.HasKey(x => x.CustomerVehicleId);

        builder.Property(x => x.CustomerVehicleId)
            .HasColumnName("customer_vehicle_id");

        builder.Property(x => x.TenantId)
            .HasColumnName("tenant_id");

        builder.Property(x => x.CustomerId)
            .HasColumnName("customer_id");

        builder.Property(x => x.VehicleId)
            .HasColumnName("vehicle_id");

        builder.Property(x => x.SourceLeadId)
            .HasColumnName("source_lead_id");

        builder.Property(x => x.OwnedFrom)
            .HasColumnName("owned_from");

        builder.Property(x => x.OwnedTo)
            .HasColumnName("owned_to");

        builder.Property(x => x.EndReason)
            .HasColumnName("end_reason")
            .HasMaxLength(50);

        builder.HasIndex(x => x.TenantId)
            .HasDatabaseName("idx_customer_vehicles_tenant");

        builder.HasIndex(x => x.CustomerId)
            .HasDatabaseName("idx_customer_vehicles_customer");

        builder.HasIndex(x => x.VehicleId)
            .HasDatabaseName("idx_customer_vehicles_vehicle");

        // Partial unique index: one open ownership per vehicle
        builder.HasIndex(x => x.VehicleId)
            .HasDatabaseName("uk_customer_vehicles_open")
            .IsUnique()
            .HasFilter("owned_to IS NULL");
    }
}

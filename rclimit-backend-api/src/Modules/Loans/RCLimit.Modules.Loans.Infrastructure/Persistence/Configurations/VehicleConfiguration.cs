using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        builder.ToTable("vehicles");
        builder.HasKey(e => e.VehicleId);
        builder.Property(e => e.VehicleId).HasColumnName("vehicle_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.RegistrationNumber).HasColumnName("registration_number").HasMaxLength(20);
        builder.Property(e => e.ChassisNumber).HasColumnName("chassis_number").HasMaxLength(50);
        builder.Property(e => e.EngineNumber).HasColumnName("engine_number").HasMaxLength(50);
        builder.Property(e => e.Make).HasColumnName("make").HasMaxLength(50);
        builder.Property(e => e.Model).HasColumnName("model").HasMaxLength(50);
        builder.Property(e => e.Variant).HasColumnName("variant").HasMaxLength(50);
        builder.Property(e => e.YearOfMfg).HasColumnName("year_of_mfg");
        builder.Property(e => e.OwnershipCount).HasColumnName("ownership_count");
        builder.Property(e => e.CurrentRtoStatus).HasColumnName("current_rto_status").HasMaxLength(30);
        builder.Property(e => e.OwnerCustomerId).HasColumnName("owner_customer_id");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne(e => e.OwnerCustomer)
            .WithMany(c => c.Vehicles)
            .HasForeignKey(e => e.OwnerCustomerId);
    }
}

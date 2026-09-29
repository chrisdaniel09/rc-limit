using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class VerificationLogConfiguration : IEntityTypeConfiguration<VerificationLog>
{
    public void Configure(EntityTypeBuilder<VerificationLog> builder)
    {
        builder.ToTable("verification_logs");
        builder.HasKey(e => e.VerificationId);
        builder.Property(e => e.VerificationId).HasColumnName("verification_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.VehicleId).HasColumnName("vehicle_id");
        builder.Property(e => e.CustomerId).HasColumnName("customer_id");
        builder.Property(e => e.VerificationType).HasColumnName("verification_type").HasMaxLength(30);
        builder.Property(e => e.RequestPayload).HasColumnName("request_payload").HasColumnType("jsonb");
        builder.Property(e => e.ResponsePayload).HasColumnName("response_payload").HasColumnType("jsonb");
        builder.Property(e => e.ResultStatus).HasColumnName("result_status").HasMaxLength(20);
        builder.Property(e => e.ExecutedAt).HasColumnName("executed_at");
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Infrastructure.Persistence.Configurations;

public class ActionExecutionConfiguration : IEntityTypeConfiguration<ActionExecution>
{
    public void Configure(EntityTypeBuilder<ActionExecution> builder)
    {
        builder.ToTable("action_executions", "leads");
        builder.HasKey(e => e.ExecutionId);
        builder.Property(e => e.ExecutionId).HasColumnName("execution_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.LeadId).HasColumnName("lead_id");
        builder.Property(e => e.ProductTypeCode).HasColumnName("product_type_code").HasMaxLength(30);
        builder.Property(e => e.ActionCode).HasColumnName("action_code").HasMaxLength(50);
        builder.Property(e => e.ActionOrder).HasColumnName("action_order");
        builder.Property(e => e.Status).HasColumnName("status").HasMaxLength(20);
        builder.Property(e => e.Source).HasColumnName("source").HasMaxLength(20);
        builder.Property(e => e.RequestPayload).HasNullableJsonColumn("request_payload");
        builder.Property(e => e.ResponsePayload).HasNullableJsonColumn("response_payload");
        builder.Property(e => e.ErrorMessage).HasColumnName("error_message");
        builder.Property(e => e.PerformedByUserId).HasColumnName("performed_by_user_id");
        builder.Property(e => e.StartedAt).HasColumnName("started_at");
        builder.Property(e => e.CompletedAt).HasColumnName("completed_at");

        // Declared so EF inserts the lead before its runs, and so deleting a lead cascades to its runs.
        builder.HasOne<Lead>()
            .WithMany()
            .HasForeignKey(e => e.LeadId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.TenantId, e.LeadId, e.ActionCode, e.StartedAt });
    }
}

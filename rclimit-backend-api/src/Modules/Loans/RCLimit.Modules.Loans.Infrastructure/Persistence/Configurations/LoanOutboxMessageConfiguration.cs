using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence.Configurations;

public class LoanOutboxMessageConfiguration : IEntityTypeConfiguration<LoanOutboxMessage>
{
    public void Configure(EntityTypeBuilder<LoanOutboxMessage> builder)
    {
        builder.ToTable("outbox_messages", LoansDbContext.Schema);
        builder.HasKey(e => e.MessageId);
        builder.Property(e => e.MessageId).HasColumnName("message_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id");
        builder.Property(e => e.EventType).HasColumnName("event_type").HasMaxLength(100);
        builder.Property(e => e.AggregateId).HasColumnName("aggregate_id");
        builder.Property(e => e.Payload).HasColumnName("payload").HasColumnType("jsonb");
        builder.Property(e => e.OccurredAt).HasColumnName("occurred_at");
        builder.Property(e => e.PublishedAt).HasColumnName("published_at");
        builder.Property(e => e.Attempts).HasColumnName("attempts");
        builder.Property(e => e.LastError).HasColumnName("last_error");
    }
}

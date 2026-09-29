using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RCLimit.Modules.System.Domain.Entities;

namespace RCLimit.Modules.System.Infrastructure.Persistence.Configurations;

public class TenantSettingsConfiguration : IEntityTypeConfiguration<TenantSettings>
{
    public void Configure(EntityTypeBuilder<TenantSettings> builder)
    {
        builder.ToTable("tenant_settings", "system");
        builder.HasKey(e => e.SettingId);
        builder.Property(e => e.SettingId).HasColumnName("setting_id");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.MaxActiveDealers).HasColumnName("max_active_dealers").HasDefaultValue(50);
        builder.Property(e => e.AllowWhatsappIntake).HasColumnName("allow_whatsapp_intake").HasDefaultValue(true);
        builder.Property(e => e.CustomVahanApiKey).HasColumnName("custom_vahan_api_key").HasMaxLength(255);
        builder.Property(e => e.CustomCibilGatewayCredentials).HasColumnName("custom_cibil_gateway_credentials").HasColumnType("jsonb");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at");
    }
}

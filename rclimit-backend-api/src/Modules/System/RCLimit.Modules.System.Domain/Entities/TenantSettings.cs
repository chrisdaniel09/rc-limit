namespace RCLimit.Modules.System.Domain.Entities;

public class TenantSettings
{
    public Guid SettingId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public int MaxActiveDealers { get; set; } = 50;
    public bool AllowWhatsappIntake { get; set; } = true;
    public string? CustomVahanApiKey { get; set; }
    public string? CustomCibilGatewayCredentials { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;
}

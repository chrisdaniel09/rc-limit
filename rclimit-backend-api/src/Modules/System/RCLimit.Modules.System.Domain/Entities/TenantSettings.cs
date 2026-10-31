namespace RCLimit.Modules.System.Domain.Entities;

public class TenantSettings
{
    public Guid SettingId { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public int MaxActiveDealers { get; set; } = 50;
    public bool AllowWhatsappIntake { get; set; } = true;
    public string? CustomVahanApiKey { get; set; }
    public string? CustomCibilGatewayCredentials { get; set; }
    public int? AccessTokenMinutes { get; set; }
    public int? IdleTimeoutDays { get; set; }
    public int? AbsoluteTimeoutDays { get; set; }
    public int? MaxSessionsPerUser { get; set; }
    // Tenant theme document (docs/ui_ux_specification.md §3.5), stored as JSONB. Null means the platform default.
    public string? Theme { get; set; }
    // Utilization tone thresholds for sub-limit meters (§6.4). Null means 70 / 90.
    public int? SubLimitWarnPct { get; set; }
    public int? SubLimitDangerPct { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;
}

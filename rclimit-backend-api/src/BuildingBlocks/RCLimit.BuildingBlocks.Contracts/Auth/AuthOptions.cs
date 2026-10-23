namespace RCLimit.BuildingBlocks.Contracts.Auth;

/// <summary>
/// Deployment profile. The single switch that selects cookie attributes, tenant host source,
/// CSRF rules and edge enforcement. See docs/user_session_architecture_specification.md, section 3.
/// </summary>
public enum DeploymentProfile
{
    /// <summary>Profile B (interim): UI and API on different sites. Cookie SameSite=None; Partitioned.</summary>
    CrossSite,

    /// <summary>Profile A (target): UI and API on one host behind the edge. Cookie SameSite=Strict.</summary>
    SameSite
}

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public DeploymentProfile DeploymentProfile { get; set; } = DeploymentProfile.CrossSite;

    public string CookieName { get; set; } = "__Secure-rclimit_rt";

    /// <summary>Origins allowed to call cookie endpoints in Profile B. Bound from Cors:AllowedOrigins.</summary>
    public string[] CorsAllowedOrigins { get; set; } = [];

    public EdgeOptions Edge { get; set; } = new();

    public SessionDefaults Session { get; set; } = new();

    public LockoutOptions Lockout { get; set; } = new();

    /// <summary>True when edge enforcement is active. Set by <see cref="Validate"/>; never bound from configuration.</summary>
    public bool EdgeEnforced { get; private set; }

    /// <summary>
    /// Validates the configuration against the selected profile. Returns the list of problems
    /// (empty when valid) and sets <see cref="EdgeEnforced"/>.
    /// </summary>
    public IReadOnlyList<string> Validate(bool isDevelopment, string? jwtSecret)
    {
        var errors = new List<string>();

        EdgeEnforced = DeploymentProfile == DeploymentProfile.SameSite
            && !(isDevelopment && Edge.DisableInDevelopment);

        if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
            errors.Add("Jwt:Secret must be at least 32 characters.");

        if (DeploymentProfile == DeploymentProfile.CrossSite)
        {
            if (CorsAllowedOrigins.Length == 0)
                errors.Add("Profile CrossSite requires at least one entry in Cors:AllowedOrigins.");
            if (EdgeEnforced)
                errors.Add("Profile CrossSite cannot enforce the edge.");
        }
        else
        {
            if (CorsAllowedOrigins.Length > 0)
                errors.Add("Profile SameSite must leave Cors:AllowedOrigins empty.");
            if (EdgeEnforced && string.IsNullOrWhiteSpace(Edge.SharedSecret))
                errors.Add("Profile SameSite with edge enforcement requires Auth:Edge:SharedSecret.");
            if (!EdgeEnforced && !isDevelopment)
                errors.Add("Profile SameSite outside Development must enforce the edge.");
        }

        if (Edge.DisableInDevelopment && !isDevelopment)
            errors.Add("Auth:Edge:DisableInDevelopment is only allowed in the Development environment.");

        return errors;
    }

    public sealed class EdgeOptions
    {
        /// <summary>Set to true only in Development to allow a dev proxy without the edge secret.</summary>
        public bool DisableInDevelopment { get; set; }

        public string SharedSecretHeader { get; set; } = "X-Edge-Secret";

        public string? SharedSecret { get; set; }
    }

    public sealed class SessionDefaults
    {
        public int AccessTokenMinutes { get; set; } = 15;

        public int IdleTimeoutDays { get; set; } = 7;

        public int AbsoluteTimeoutDays { get; set; } = 30;

        /// <summary>Window after a rotation in which a re-presented token returns 409 instead of revoking the family.</summary>
        public int ReuseGraceSeconds { get; set; } = 30;
    }

    public sealed class LockoutOptions
    {
        public int MaxFailedAttempts { get; set; } = 5;

        public int LockoutMinutes { get; set; } = 15;
    }
}

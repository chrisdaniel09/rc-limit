namespace RCLimit.Modules.Identity.Domain.Entities;

/// <summary>
/// One refresh token in a session family. Rotation creates a new row in the same family and revokes the old one.
/// Only the SHA-256 hash of the token is stored (spec section 4).
/// </summary>
public class RefreshToken
{
    public Guid TokenId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid FamilyId { get; private set; }
    public string TokenHash { get; private set; } = default!;
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public DateTime SessionStartedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public bool IsRevoked { get; private set; }
    public DateTime? RevokedAt { get; private set; }
    public string? RevokedReason { get; private set; }
    public Guid? ReplacedByTokenId { get; private set; }
    public DateTime? LastUsedAt { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public User User { get; private set; } = default!;

    private RefreshToken() { }

    public static RefreshToken Create(
        Guid userId,
        Guid tenantId,
        Guid familyId,
        string tokenHash,
        DateTime sessionStartedAt,
        DateTime expiresAt,
        string? ipAddress,
        string? userAgent)
    {
        return new RefreshToken
        {
            TokenId = Guid.NewGuid(),
            UserId = userId,
            TenantId = tenantId,
            FamilyId = familyId,
            TokenHash = tokenHash,
            SessionStartedAt = sessionStartedAt,
            ExpiresAt = expiresAt,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>Marks this token as replaced by its successor in the same family.</summary>
    public void Rotate(Guid replacedByTokenId, DateTime now)
    {
        IsRevoked = true;
        RevokedAt = now;
        RevokedReason = RefreshRevocationReasons.Rotated;
        ReplacedByTokenId = replacedByTokenId;
        LastUsedAt = now;
    }

    public void Revoke(string reason, DateTime now)
    {
        if (IsRevoked)
            return;

        IsRevoked = true;
        RevokedAt = now;
        RevokedReason = reason;
    }

    public bool IsExpired(DateTime now) => now >= ExpiresAt;
}

/// <summary>Reasons written to auth.refresh_tokens.revoked_reason.</summary>
public static class RefreshRevocationReasons
{
    public const string Rotated = "ROTATED";
    public const string Logout = "LOGOUT";
    public const string ReuseDetected = "REUSE_DETECTED";
    public const string AdminReset = "ADMIN_RESET";
    public const string Expired = "EXPIRED";
    public const string Deactivated = "DEACTIVATED";
    public const string SessionCap = "SESSION_CAP";
}

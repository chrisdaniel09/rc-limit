namespace RCLimit.Modules.Identity.Domain.Entities;

public class User
{
    public Guid UserId { get; private set; }
    public Guid TenantId { get; private set; }
    public string? Email { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? PasswordHash { get; private set; }
    public string? PasswordSalt { get; private set; }
    public string? FullName { get; private set; }
    public string? AvatarUrl { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool TwoFactorEnabled { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; private set; }

    public ICollection<UserIdentity> Identities { get; private set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; private set; } = [];

    private User() { }

    public static User Create(
        Guid tenantId,
        string email,
        string fullName,
        string? phoneNumber,
        string passwordHash,
        string passwordSalt)
    {
        return new User
        {
            UserId = Guid.NewGuid(),
            TenantId = tenantId,
            Email = email,
            FullName = fullName,
            PhoneNumber = phoneNumber,
            PasswordHash = passwordHash,
            PasswordSalt = passwordSalt,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void RecordLogin() => LastLoginAt = DateTime.UtcNow;

    public void UpdatePassword(string hash, string salt)
    {
        PasswordHash = hash;
        PasswordSalt = salt;
    }
}

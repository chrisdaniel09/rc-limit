namespace RCLimit.Modules.Identity.Domain.Entities;

public class UserIdentity
{
    public Guid IdentityId { get; private set; }
    public Guid UserId { get; private set; }
    public string ProviderType { get; private set; } = default!;
    public string ProviderUserId { get; private set; } = default!;
    public string? IdentityData { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public User User { get; private set; } = default!;

    private UserIdentity() { }

    public static UserIdentity Create(Guid userId, string providerType, string providerUserId, string? identityData = null)
    {
        return new UserIdentity
        {
            IdentityId = Guid.NewGuid(),
            UserId = userId,
            ProviderType = providerType,
            ProviderUserId = providerUserId,
            IdentityData = identityData,
            CreatedAt = DateTime.UtcNow
        };
    }
}

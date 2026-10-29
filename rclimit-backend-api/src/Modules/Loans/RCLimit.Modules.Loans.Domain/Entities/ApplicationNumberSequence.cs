namespace RCLimit.Modules.Loans.Domain.Entities;

// Next application number for a tenant (decision D3).
public class ApplicationNumberSequence
{
    public Guid TenantId { get; set; }
    public long NextValue { get; set; } = 1;

    // Row version (PostgreSQL xmin). Two creates cannot take the same number.
    public uint Version { get; set; }
}

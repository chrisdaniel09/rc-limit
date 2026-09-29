namespace RCLimit.BuildingBlocks.Domain;

public abstract class Entity
{
    public Guid Id { get; protected set; }
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; protected set; }

    protected Entity() { }

    protected Entity(Guid id)
    {
        Id = id;
    }

    public override bool Equals(object? obj)
    {
        if (obj is not Entity other)
            return false;
        if (ReferenceEquals(this, other))
            return true;
        if (Id == Guid.Empty || other.Id == Guid.Empty)
            return false;
        return Id == other.Id;
    }

    public override int GetHashCode() => Id.GetHashCode();
}

namespace RCLimit.BuildingBlocks.Contracts.Hateoas;

public record HateoasLink(string Href, string Rel, string Method);

public class HateoasResponse<T>
{
    public T Data { get; init; } = default!;
    public List<HateoasLink> Links { get; init; } = [];
}

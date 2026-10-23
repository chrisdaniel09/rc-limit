using System.Text.Json.Serialization;

namespace RCLimit.BuildingBlocks.Contracts.Hateoas;

public record HateoasLink(string Href, string Rel, string Method);

public record PageMeta(int Page, int PageSize, int TotalCount, int TotalPages);

public class HateoasResponse<T>
{
    public T Data { get; init; } = default!;
    public List<HateoasLink> Links { get; init; } = [];

    // Only set by paged endpoints; omitted from the JSON otherwise so un-paged responses are unchanged.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public PageMeta? Meta { get; init; }
}

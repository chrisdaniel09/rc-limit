using System.Text.Json.Serialization;

namespace RCLimit.BuildingBlocks.Contracts.Hateoas;

public record HateoasLink(string Href, string Rel, string Method);

// Totals are aggregates over the whole filter, when a list sends them (docs/ui_ux_specification.md §15-6).
public record PageMeta(int Page, int PageSize, int TotalCount, int TotalPages)
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyDictionary<string, decimal>? Totals { get; init; }
}

public class HateoasResponse<T>
{
    public T Data { get; init; } = default!;
    public List<HateoasLink> Links { get; init; } = [];

    // Only set by paged endpoints; omitted from the JSON otherwise so un-paged responses are unchanged.
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public PageMeta? Meta { get; init; }
}

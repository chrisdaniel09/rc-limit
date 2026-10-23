using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.BuildingBlocks.Domain.Paging;

/// <summary>
/// Paging, search and sort parameters shared by every paged list endpoint.
/// Page and page size are normalised rather than rejected; unknown sort fields and directions are rejected.
/// </summary>
public sealed record PageQuery(
    int Page = 1,
    int PageSize = PageQuery.DefaultPageSize,
    string? SortBy = null,
    string? SortDir = null,
    string? Search = null)
{
    public const int DefaultPageSize = 25;
    public const int MaxPageSize = 100;

    public int NormalizedPage => Math.Max(1, Page);

    public int NormalizedPageSize => Math.Clamp(PageSize, 1, MaxPageSize);

    public int Skip => (NormalizedPage - 1) * NormalizedPageSize;

    public bool HasSortBy => !string.IsNullOrWhiteSpace(SortBy);

    public string? SearchTerm => string.IsNullOrWhiteSpace(Search) ? null : Search.Trim();

    /// <summary>
    /// Resolves the requested direction. Returns the default when no direction was supplied.
    /// </summary>
    public bool IsDescending(bool defaultDescending)
    {
        if (string.IsNullOrWhiteSpace(SortDir))
            return defaultDescending;

        return SortDir.Trim().ToLowerInvariant() switch
        {
            "asc" => false,
            "desc" => true,
            _ => throw new ValidationException($"Unsupported sort direction '{SortDir}'. Use 'asc' or 'desc'.", "INVALID_SORT_DIRECTION"),
        };
    }

    /// <summary>
    /// Builds a case-insensitive "contains" LIKE pattern. Wildcards in the user's text are escaped so they match literally.
    /// Use as EF.Functions.Like(column.ToLower(), pattern). Lowercasing both sides keeps this provider-neutral
    /// (Application projects do not reference Npgsql, so ILike is not available there).
    /// </summary>
    public static string ContainsPattern(string term)
    {
        var escaped = term.ToLowerInvariant()
            .Replace(@"\", @"\\")
            .Replace("%", @"\%")
            .Replace("_", @"\_");
        return $"%{escaped}%";
    }
}

using System.Linq.Expressions;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.BuildingBlocks.Domain.Paging;

public static class PagingExtensions
{
    /// <summary>
    /// Orders by the whitelisted sort field (or the default when none is requested), then by a unique
    /// tiebreaker so pages never repeat or skip rows. Unknown sort fields are rejected.
    /// Sort keys must be entity properties so the database performs the ordering.
    /// </summary>
    public static IOrderedQueryable<T> ApplySort<T>(
        this IQueryable<T> query,
        PageQuery paging,
        IReadOnlyDictionary<string, Expression<Func<T, object?>>> sortMap,
        (string Key, bool Descending) defaultSort,
        Expression<Func<T, object?>> tiebreaker)
    {
        var key = paging.HasSortBy ? paging.SortBy!.Trim() : defaultSort.Key;
        if (!sortMap.TryGetValue(key, out var keySelector))
            throw new ValidationException($"Unsupported sort field '{key}'.", "INVALID_SORT_FIELD");

        var descending = paging.IsDescending(defaultSort.Descending);

        var ordered = descending
            ? query.OrderByDescending(keySelector)
            : query.OrderBy(keySelector);

        return ordered.ThenBy(tiebreaker);
    }
}

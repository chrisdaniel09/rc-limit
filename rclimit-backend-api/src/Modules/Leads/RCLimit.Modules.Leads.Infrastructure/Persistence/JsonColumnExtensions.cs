using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace RCLimit.Modules.Leads.Infrastructure.Persistence;

// Maps a .NET value to a jsonb column as JSON text, with change tracking that compares content.
public static class JsonColumnExtensions
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static PropertyBuilder<T> HasJsonColumn<T>(this PropertyBuilder<T> builder, string column)
        where T : notnull
    {
        var converter = new ValueConverter<T, string>(
            v => JsonSerializer.Serialize(v, Options),
            s => JsonSerializer.Deserialize<T>(s, Options)!);

        var comparer = new ValueComparer<T>(
            (a, b) => JsonSerializer.Serialize(a, Options) == JsonSerializer.Serialize(b, Options),
            v => JsonSerializer.Serialize(v, Options).GetHashCode(),
            v => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(v, Options), Options)!);

        builder.HasColumnName(column).HasColumnType("jsonb").HasConversion(converter);
        builder.Metadata.SetValueComparer(comparer);
        return builder;
    }

    public static PropertyBuilder<JsonElement?> HasNullableJsonColumn(this PropertyBuilder<JsonElement?> builder, string column)
    {
        var converter = new ValueConverter<JsonElement?, string?>(
            v => v.HasValue ? JsonSerializer.Serialize(v.Value, Options) : null,
            s => s == null ? null : JsonSerializer.Deserialize<JsonElement>(s, Options));

        var comparer = new ValueComparer<JsonElement?>(
            (a, b) => ToText(a) == ToText(b),
            v => (ToText(v) ?? string.Empty).GetHashCode(),
            v => v.HasValue ? JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(v.Value, Options), Options) : null);

        builder.HasColumnName(column).HasColumnType("jsonb").HasConversion(converter);
        builder.Metadata.SetValueComparer(comparer);
        return builder;
    }

    private static string? ToText(JsonElement? value) =>
        value.HasValue ? JsonSerializer.Serialize(value.Value, Options) : null;
}

using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.ProductTypes;

// Checks a lead's product details against its product type's field schema.
// Returns only the accepted fields, in the form they are stored. Collects every error before failing.
public static class ProductFieldValidator
{
    public const string VehicleRegistrationRole = "vehicle_registration";

    public static Dictionary<string, JsonElement> Normalize(
        IReadOnlyCollection<ProductFieldDefinition> schema,
        IReadOnlyDictionary<string, JsonElement> input)
    {
        var errors = new List<string>();
        var fieldsByKey = schema.ToDictionary(f => f.Key, StringComparer.Ordinal);

        foreach (var key in input.Keys)
        {
            if (!fieldsByKey.ContainsKey(key))
                errors.Add($"'{key}' is not a field of this financial requirement.");
        }

        var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);

        foreach (var field in schema)
        {
            var hasValue = input.TryGetValue(field.Key, out var raw) && !IsEmpty(raw);

            if (!hasValue)
            {
                if (field.Required)
                    errors.Add($"{field.Label} is required.");
                continue;
            }

            var stored = ValidateValue(field, raw, errors);
            if (stored is not null)
                result[field.Key] = stored.Value;
        }

        if (errors.Count > 0)
            throw new BusinessRuleException(string.Join(" ", errors));

        return result;
    }

    // Reference number used for search and customer matching. Vehicle registrations are normalised the same way
    // the vehicles module does: upper case, no spaces or hyphens.
    public static string? DeriveReferenceNumber(
        IReadOnlyCollection<ProductFieldDefinition> schema,
        IReadOnlyDictionary<string, JsonElement> details)
    {
        var field = schema.FirstOrDefault(f => f.Role == VehicleRegistrationRole);
        if (field is null || !details.TryGetValue(field.Key, out var value) || value.ValueKind != JsonValueKind.String)
            return null;

        return value.GetString()!.Replace(" ", string.Empty).Replace("-", string.Empty).ToUpperInvariant();
    }

    private static bool IsEmpty(JsonElement value) =>
        value.ValueKind == JsonValueKind.Null
        || value.ValueKind == JsonValueKind.Undefined
        || (value.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(value.GetString()));

    private static JsonElement? ValidateValue(ProductFieldDefinition field, JsonElement raw, List<string> errors)
    {
        switch (field.Type)
        {
            case "text":
            {
                if (raw.ValueKind != JsonValueKind.String)
                {
                    errors.Add($"{field.Label} must be text.");
                    return null;
                }

                var text = raw.GetString()!.Trim();
                if (field.Validation?.Pattern is { } pattern && !Regex.IsMatch(text, pattern))
                {
                    errors.Add($"{field.Label} is not in the expected format.");
                    return null;
                }
                return JsonSerializer.SerializeToElement(text);
            }

            case "number":
            {
                if (raw.ValueKind != JsonValueKind.Number || !raw.TryGetDecimal(out var number))
                {
                    errors.Add($"{field.Label} must be a number.");
                    return null;
                }

                if (field.Validation?.Min is { } min && number < min)
                    errors.Add($"{field.Label} must be at least {min}.");
                if (field.Validation?.Max is { } max && number > max)
                    errors.Add($"{field.Label} must be at most {max}.");

                return errors.Count > 0 ? null : JsonSerializer.SerializeToElement(number);
            }

            case "date":
            {
                if (raw.ValueKind != JsonValueKind.String
                    || !DateOnly.TryParseExact(raw.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                {
                    errors.Add($"{field.Label} must be a date in yyyy-MM-dd format.");
                    return null;
                }
                return JsonSerializer.SerializeToElement(date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            }

            case "select":
            {
                var options = field.Validation?.Options ?? [];
                var choice = raw.ValueKind == JsonValueKind.String ? raw.GetString() : null;
                if (choice is null || !options.Contains(choice))
                {
                    errors.Add($"{field.Label} must be one of: {string.Join(", ", options)}.");
                    return null;
                }
                return JsonSerializer.SerializeToElement(choice);
            }

            default:
                errors.Add($"{field.Label} has an unsupported type '{field.Type}'.");
                return null;
        }
    }
}

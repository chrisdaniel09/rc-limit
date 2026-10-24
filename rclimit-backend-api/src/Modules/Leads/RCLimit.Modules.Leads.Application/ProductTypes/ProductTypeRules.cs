using System.Text.RegularExpressions;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.ProductTypes;

// Checks a product type's field schema and action list before they are saved.
public static class ProductTypeRules
{
    public static readonly string[] FieldTypes = ["text", "number", "date", "select"];

    public static readonly string[] Roles =
    [
        "vehicle_registration",
        "vehicle_chassis",
        "vehicle_engine",
        "vehicle_make",
        "vehicle_model",
        "vehicle_variant",
        "vehicle_year"
    ];

    private static readonly Regex FieldKey = new("^[a-z][a-z0-9_]{0,49}$", RegexOptions.CultureInvariant);
    private static readonly Regex ProductCode = new("^[A-Z][A-Z0-9_]{1,29}$", RegexOptions.CultureInvariant);

    public static string NormalizeCode(string code)
    {
        var normalized = code.Trim().ToUpperInvariant();
        if (!ProductCode.IsMatch(normalized))
            throw new BusinessRuleException("Product code must be 2-30 characters: letters, digits and underscores, starting with a letter.");
        return normalized;
    }

    public static void Validate(
        IReadOnlyCollection<ProductFieldDefinition> fields,
        IReadOnlyCollection<ActionDefinition> actions,
        IActionRegistry registry)
    {
        ValidateFields(fields);
        ValidateActions(actions, registry);
    }

    private static void ValidateFields(IReadOnlyCollection<ProductFieldDefinition> fields)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        var roles = new HashSet<string>(StringComparer.Ordinal);

        foreach (var field in fields)
        {
            if (!FieldKey.IsMatch(field.Key))
                throw new BusinessRuleException($"Field key '{field.Key}' must be lower case letters, digits and underscores.");
            if (!keys.Add(field.Key))
                throw new BusinessRuleException($"Field key '{field.Key}' is used more than once.");
            if (string.IsNullOrWhiteSpace(field.Label))
                throw new BusinessRuleException($"Field '{field.Key}' needs a label.");
            if (!FieldTypes.Contains(field.Type))
                throw new BusinessRuleException($"Field '{field.Key}' has an unknown type '{field.Type}'.");

            if (field.Role is not null)
            {
                if (!Roles.Contains(field.Role))
                    throw new BusinessRuleException($"Field '{field.Key}' has an unknown role '{field.Role}'.");
                if (!roles.Add(field.Role))
                    throw new BusinessRuleException($"Role '{field.Role}' is used by more than one field.");
            }

            if (field.Validation is null) continue;

            if (field.Validation.Pattern is { } pattern)
            {
                try { _ = new Regex(pattern); }
                catch (ArgumentException)
                {
                    throw new BusinessRuleException($"Field '{field.Key}' has an invalid pattern.");
                }
            }

            if (field.Type == "select" && (field.Validation.Options is null || field.Validation.Options.Count == 0))
                throw new BusinessRuleException($"Select field '{field.Key}' needs at least one option.");

            if (field.Validation.Min is { } min && field.Validation.Max is { } max && min > max)
                throw new BusinessRuleException($"Field '{field.Key}' has a minimum greater than its maximum.");
        }
    }

    private static void ValidateActions(IReadOnlyCollection<ActionDefinition> actions, IActionRegistry registry)
    {
        var orders = new HashSet<int>();

        foreach (var action in actions)
        {
            if (!registry.IsRegistered(action.Code))
                throw new BusinessRuleException($"Action '{action.Code}' is not implemented by the backend.");
            if (action.Order < 1)
                throw new BusinessRuleException($"Action '{action.Code}' needs an order of 1 or more.");
            if (!orders.Add(action.Order))
                throw new BusinessRuleException($"Two actions share the order {action.Order}.");
        }
    }
}

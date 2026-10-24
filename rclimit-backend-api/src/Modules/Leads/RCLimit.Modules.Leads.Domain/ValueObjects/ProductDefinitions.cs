using System.Text.Json;

namespace RCLimit.Modules.Leads.Domain.ValueObjects;

// One field a product type captures on a lead. Stored in leads.product_types.field_schema.
// Role is optional. It tells the backend what a field means, e.g. "vehicle_registration".
public sealed record ProductFieldDefinition(
    string Key,
    string Label,
    string Type,
    bool Required,
    string? Role,
    FieldValidation? Validation);

public sealed record FieldValidation(
    string? Pattern,
    decimal? Min,
    decimal? Max,
    IReadOnlyList<string>? Options);

// One action a product type runs, in order. Stored in leads.product_types.actions.
// Code selects the IAction implementation. Config is passed to that implementation when it is created.
public sealed record ActionDefinition(
    string Code,
    int Order,
    Dictionary<string, JsonElement> Config);

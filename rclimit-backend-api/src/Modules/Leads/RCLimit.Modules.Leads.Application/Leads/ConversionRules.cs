using System.Text.Json;
using System.Text.RegularExpressions;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;
using RCLimit.Modules.Loans.Contracts.Vehicles;

namespace RCLimit.Modules.Leads.Application.Leads;

// Maps a product's vehicle roles to the vehicle fields they fill on conversion.
public static class LeadVehicleDetails
{
    public const string RegistrationRole = "vehicle_registration";

    // Keys are the roles in the product type's field schema. Values are VehicleDetailsDto property names.
    public static readonly IReadOnlyDictionary<string, string> FieldByRole = new Dictionary<string, string>
    {
        [RegistrationRole] = nameof(VehicleDetailsDto.RegistrationNumber),
        ["vehicle_chassis"] = nameof(VehicleDetailsDto.ChassisNumber),
        ["vehicle_engine"] = nameof(VehicleDetailsDto.EngineNumber),
        ["vehicle_make"] = nameof(VehicleDetailsDto.Make),
        ["vehicle_model"] = nameof(VehicleDetailsDto.Model),
        ["vehicle_variant"] = nameof(VehicleDetailsDto.Variant),
        ["vehicle_year"] = nameof(VehicleDetailsDto.YearOfMfg),
    };

    public static readonly IReadOnlyDictionary<string, string> RoleByField =
        FieldByRole.ToDictionary(kv => kv.Value, kv => kv.Key);

    // Returns null when the lead's product has no vehicle registration, which means there is no vehicle step.
    public static VehicleDetailsDto? From(Lead lead, ProductType? productType)
    {
        if (productType is null)
            return null;

        string? registration = null;
        string? chassis = null, engine = null, make = null, model = null, variant = null;
        int? year = null;

        foreach (var field in productType.FieldSchema)
        {
            if (field.Role is null || !FieldByRole.ContainsKey(field.Role))
                continue;
            if (!lead.ProductDetails.TryGetValue(field.Key, out var value))
                continue;

            switch (field.Role)
            {
                case RegistrationRole: registration = Text(value); break;
                case "vehicle_chassis": chassis = Text(value); break;
                case "vehicle_engine": engine = Text(value); break;
                case "vehicle_make": make = Text(value); break;
                case "vehicle_model": model = Text(value); break;
                case "vehicle_variant": variant = Text(value); break;
                case "vehicle_year": year = Number(value); break;
            }
        }

        if (string.IsNullOrWhiteSpace(registration))
            return null;

        return new VehicleDetailsDto(
            Normalize(registration),
            chassis,
            engine,
            make,
            model,
            variant,
            year);
    }

    // Same normalisation as the vehicles module: upper case, no spaces or hyphens.
    private static string Normalize(string registration) =>
        Regex.Replace(registration.ToUpperInvariant().Trim(), @"[\s\-]", "");

    private static string? Text(JsonElement value) =>
        value.ValueKind == JsonValueKind.String ? value.GetString()?.Trim() : value.ToString();

    private static int? Number(JsonElement value) =>
        value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var year) ? year : null;
}

// The user's choice for each field where the lead and the vehicle hold different values.
public static class ConflictDecisions
{
    public const string UseLead = "LEAD";
    public const string KeepVehicle = "VEHICLE";

    private static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>
    {
        [nameof(VehicleDetailsDto.ChassisNumber)] = "Chassis number",
        [nameof(VehicleDetailsDto.EngineNumber)] = "Engine number",
        [nameof(VehicleDetailsDto.Make)] = "Make",
        [nameof(VehicleDetailsDto.Model)] = "Model",
        [nameof(VehicleDetailsDto.Variant)] = "Variant",
        [nameof(VehicleDetailsDto.YearOfMfg)] = "Year of manufacture",
    };

    // Returns the field names the lead should overwrite. Throws if any conflict has no decision,
    // or if a decision names a role that is not a vehicle field or has an unknown value.
    public static IReadOnlySet<string> OverwriteFields(
        IReadOnlyList<VehicleFieldConflictDto> conflicts,
        IReadOnlyDictionary<string, string>? decisions)
    {
        decisions ??= new Dictionary<string, string>();

        foreach (var (role, choice) in decisions)
        {
            if (!LeadVehicleDetails.FieldByRole.ContainsKey(role) || role == LeadVehicleDetails.RegistrationRole)
                throw new BusinessRuleException($"'{role}' is not a vehicle field that can be reconciled.");
            if (choice is not (UseLead or KeepVehicle))
                throw new BusinessRuleException($"Choice for '{role}' must be {UseLead} or {KeepVehicle}.");
        }

        var unresolved = conflicts
            .Where(c => !decisions.ContainsKey(LeadVehicleDetails.RoleByField[c.Field]))
            .Select(c => Labels.GetValueOrDefault(c.Field, c.Field))
            .ToList();

        if (unresolved.Count > 0)
            throw new BusinessRuleException(
                $"Choose which value to keep for: {string.Join(", ", unresolved)}.");

        return conflicts
            .Where(c => decisions[LeadVehicleDetails.RoleByField[c.Field]] == UseLead)
            .Select(c => c.Field)
            .ToHashSet(StringComparer.Ordinal);
    }
}

// Reads a CIBIL score from the response payloads of successful CIBIL_CHECK runs.
public static class ActionScores
{
    // The first payload, in the order given, that carries a numeric score. Pass the newest run first.
    public static int? LatestScore(IEnumerable<JsonElement?> responses)
    {
        foreach (var response in responses)
        {
            if (response is { ValueKind: JsonValueKind.Object } payload
                && payload.TryGetProperty("score", out var score)
                && score.ValueKind == JsonValueKind.Number
                && score.TryGetInt32(out var value))
            {
                return value;
            }
        }

        return null;
    }
}

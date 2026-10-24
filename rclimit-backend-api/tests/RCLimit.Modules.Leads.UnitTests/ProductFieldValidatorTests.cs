using System.Text.Json;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.ProductTypes;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.UnitTests;

public class ProductFieldValidatorTests
{
    private static readonly List<ProductFieldDefinition> VehicleSchema =
    [
        new("registration_number", "Vehicle registration number", "text", true, "vehicle_registration",
            new FieldValidation("^[A-Za-z]{2}[ -]?[0-9]{1,2}[ -]?[A-Za-z]{0,3}[ -]?[0-9]{4}$", null, null, null)),
        new("make", "Make", "text", false, null, null),
        new("year_of_manufacture", "Year of manufacture", "number", false, "vehicle_year",
            new FieldValidation(null, 1990, 2030, null)),
        new("fuel_type", "Fuel type", "select", false, null,
            new FieldValidation(null, null, null, ["DIESEL", "CNG", "ELECTRIC"])),
        new("first_registered_on", "First registered on", "date", false, null, null)
    ];

    private static Dictionary<string, JsonElement> Input(params (string Key, object Value)[] pairs) =>
        pairs.ToDictionary(p => p.Key, p => JsonSerializer.SerializeToElement(p.Value), StringComparer.Ordinal);

    [Fact]
    public void Normalize_keeps_valid_values_and_trims_text()
    {
        var result = ProductFieldValidator.Normalize(VehicleSchema, Input(
            ("registration_number", "  GJ05BX6637 "),
            ("make", "Tata"),
            ("year_of_manufacture", 2019),
            ("fuel_type", "DIESEL"),
            ("first_registered_on", "2019-06-01")));

        Assert.Equal("GJ05BX6637", result["registration_number"].GetString());
        Assert.Equal("Tata", result["make"].GetString());
        Assert.Equal(2019, result["year_of_manufacture"].GetDecimal());
        Assert.Equal("DIESEL", result["fuel_type"].GetString());
        Assert.Equal("2019-06-01", result["first_registered_on"].GetString());
    }

    [Fact]
    public void Normalize_drops_optional_fields_that_are_blank()
    {
        var result = ProductFieldValidator.Normalize(VehicleSchema, Input(
            ("registration_number", "GJ05BX6637"),
            ("make", "   ")));

        Assert.DoesNotContain("make", result.Keys);
    }

    [Fact]
    public void Normalize_reports_a_missing_required_field()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(("make", "Tata"))));

        Assert.Contains("Vehicle registration number is required.", ex.Message);
    }

    [Fact]
    public void Normalize_rejects_a_key_the_schema_does_not_define()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(
                ("registration_number", "GJ05BX6637"),
                ("colour", "white"))));

        Assert.Contains("'colour' is not a field", ex.Message);
    }

    [Fact]
    public void Normalize_rejects_a_pattern_mismatch()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(("registration_number", "12345"))));

        Assert.Contains("not in the expected format", ex.Message);
    }

    [Fact]
    public void Normalize_rejects_a_number_outside_its_range()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(
                ("registration_number", "GJ05BX6637"),
                ("year_of_manufacture", 1950))));

        Assert.Contains("must be at least 1990", ex.Message);
    }

    [Fact]
    public void Normalize_rejects_text_sent_for_a_number()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(
                ("registration_number", "GJ05BX6637"),
                ("year_of_manufacture", "2019"))));

        Assert.Contains("must be a number", ex.Message);
    }

    [Fact]
    public void Normalize_rejects_a_select_value_not_in_its_options()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(
                ("registration_number", "GJ05BX6637"),
                ("fuel_type", "PETROL"))));

        Assert.Contains("must be one of: DIESEL, CNG, ELECTRIC", ex.Message);
    }

    [Fact]
    public void Normalize_rejects_a_date_not_in_iso_format()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(
                ("registration_number", "GJ05BX6637"),
                ("first_registered_on", "01/06/2019"))));

        Assert.Contains("yyyy-MM-dd", ex.Message);
    }

    [Fact]
    public void Normalize_reports_every_error_together()
    {
        var ex = Assert.Throws<BusinessRuleException>(() =>
            ProductFieldValidator.Normalize(VehicleSchema, Input(
                ("make", "Tata"),
                ("colour", "white"),
                ("year_of_manufacture", 1950))));

        Assert.Contains("Vehicle registration number is required.", ex.Message);
        Assert.Contains("'colour' is not a field", ex.Message);
        Assert.Contains("must be at least 1990", ex.Message);
    }

    [Fact]
    public void DeriveReferenceNumber_uses_the_vehicle_registration_role()
    {
        var details = Input(("registration_number", "gj 05-bx 6637"));

        Assert.Equal("GJ05BX6637", ProductFieldValidator.DeriveReferenceNumber(VehicleSchema, details));
    }

    [Fact]
    public void DeriveReferenceNumber_is_null_when_the_product_has_no_vehicle_field()
    {
        var schema = new List<ProductFieldDefinition>
        {
            new("policy_number", "Policy number", "text", false, null, null)
        };

        Assert.Null(ProductFieldValidator.DeriveReferenceNumber(schema, Input(("policy_number", "P-1"))));
    }
}

using System.Text.Json;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Leads;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;
using RCLimit.Modules.Loans.Contracts.Vehicles;

namespace RCLimit.Modules.Leads.UnitTests;

public class ConversionRulesTests
{
    private static ProductType VehicleProduct() => new()
    {
        Code = "USED_CV",
        FieldSchema =
        [
            new ProductFieldDefinition("registration_number", "Registration", "text", true, "vehicle_registration", null),
            new ProductFieldDefinition("make", "Make", "text", false, "vehicle_make", null),
            new ProductFieldDefinition("year", "Year", "number", false, "vehicle_year", null),
            new ProductFieldDefinition("colour", "Colour", "text", false, null, null)
        ]
    };

    private static Lead LeadWith(params (string Key, object Value)[] details) => new()
    {
        ProductDetails = details.ToDictionary(d => d.Key, d => JsonSerializer.SerializeToElement(d.Value))
    };

    private static VehicleFieldConflictDto Conflict(string field, string current, string incoming) =>
        new(field, current, incoming);

    [Fact]
    public void From_returns_null_when_the_product_type_is_unknown()
    {
        Assert.Null(LeadVehicleDetails.From(LeadWith(("registration_number", "GJ05BX6637")), null));
    }

    [Fact]
    public void From_returns_null_when_the_product_has_no_registration_value()
    {
        var details = LeadVehicleDetails.From(LeadWith(("make", "Tata")), VehicleProduct());

        Assert.Null(details);
    }

    [Fact]
    public void From_normalises_the_registration_and_maps_each_role_to_its_field()
    {
        var details = LeadVehicleDetails.From(
            LeadWith(("registration_number", "gj 05-bx 6637"), ("make", "Tata"), ("year", 2019), ("colour", "white")),
            VehicleProduct());

        Assert.NotNull(details);
        Assert.Equal("GJ05BX6637", details.RegistrationNumber);
        Assert.Equal("Tata", details.Make);
        Assert.Equal(2019, details.YearOfMfg);
        Assert.Null(details.Model);
    }

    [Fact]
    public void OverwriteFields_needs_no_decisions_when_there_are_no_conflicts()
    {
        var result = ConflictDecisions.OverwriteFields([], null);

        Assert.Empty(result);
    }

    [Fact]
    public void OverwriteFields_refuses_to_convert_while_a_conflict_is_undecided()
    {
        var conflicts = new[] { Conflict("Make", "Mahindra", "Tata"), Conflict("YearOfMfg", "2018", "2019") };
        var decisions = new Dictionary<string, string> { ["vehicle_make"] = ConflictDecisions.UseLead };

        var ex = Assert.Throws<BusinessRuleException>(() => ConflictDecisions.OverwriteFields(conflicts, decisions));

        Assert.Contains("Year of manufacture", ex.Message);
        Assert.DoesNotContain("Make", ex.Message);
    }

    [Fact]
    public void OverwriteFields_returns_only_the_fields_where_the_lead_value_is_chosen()
    {
        var conflicts = new[] { Conflict("Make", "Mahindra", "Tata"), Conflict("Model", "Bolero", "407") };
        var decisions = new Dictionary<string, string>
        {
            ["vehicle_make"] = ConflictDecisions.UseLead,
            ["vehicle_model"] = ConflictDecisions.KeepVehicle
        };

        var result = ConflictDecisions.OverwriteFields(conflicts, decisions);

        Assert.Equal(["Make"], result);
    }

    [Theory]
    [InlineData("vehicle_registration")]
    [InlineData("vehicle_colour")]
    public void OverwriteFields_rejects_decisions_for_roles_that_are_not_reconcilable_vehicle_fields(string role)
    {
        var decisions = new Dictionary<string, string> { [role] = ConflictDecisions.UseLead };

        Assert.Throws<BusinessRuleException>(() => ConflictDecisions.OverwriteFields([], decisions));
    }

    [Fact]
    public void OverwriteFields_rejects_an_unknown_choice()
    {
        var conflicts = new[] { Conflict("Make", "Mahindra", "Tata") };
        var decisions = new Dictionary<string, string> { ["vehicle_make"] = "BOTH" };

        Assert.Throws<BusinessRuleException>(() => ConflictDecisions.OverwriteFields(conflicts, decisions));
    }

    [Fact]
    public void LatestScore_takes_the_first_payload_that_carries_a_score()
    {
        var responses = new JsonElement?[]
        {
            JsonSerializer.SerializeToElement(new { outcome = "PASSED", remarks = "no score" }),
            JsonSerializer.SerializeToElement(new { outcome = "PASSED", score = 745 }),
            JsonSerializer.SerializeToElement(new { outcome = "PASSED", score = 612 })
        };

        Assert.Equal(745, ActionScores.LatestScore(responses));
    }

    [Fact]
    public void LatestScore_is_null_when_no_run_has_a_score()
    {
        var responses = new JsonElement?[] { null, JsonSerializer.SerializeToElement(new { outcome = "FAILED" }) };

        Assert.Null(ActionScores.LatestScore(responses));
    }
}

using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Leads.Application.ProductTypes;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.UnitTests;

public class ProductTypeRulesTests
{
    private static readonly IActionRegistry Registry = new FakeRegistry(ActionCodes.CibilCheck, ActionCodes.VahanCheck);

    private static ProductFieldDefinition Field(string key, string? role = null, string type = "text", FieldValidation? validation = null) =>
        new(key, "Label", type, true, role, validation);

    private static ActionDefinition Action(string code, int order) =>
        new(code, order, new Dictionary<string, System.Text.Json.JsonElement>());

    [Fact]
    public void Validate_accepts_a_schema_with_registered_actions()
    {
        var fields = new List<ProductFieldDefinition>
        {
            new("registration_number", "Vehicle registration number", "text", true, "vehicle_registration",
                new FieldValidation("^[A-Z0-9 -]+$", null, null, null))
        };
        var actions = new List<ActionDefinition>
        {
            Action(ActionCodes.CibilCheck, 1),
            Action(ActionCodes.VahanCheck, 2)
        };

        ProductTypeRules.Validate(fields, actions, Registry);
    }

    [Fact]
    public void Validate_accepts_an_empty_product_with_no_fields_or_actions()
    {
        ProductTypeRules.Validate([], [], Registry);
    }

    [Fact]
    public void Validate_rejects_duplicate_field_keys()
    {
        var fields = new List<ProductFieldDefinition> { Field("make"), Field("make") };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
        Assert.Contains("'make' is used more than once", ex.Message);
    }

    [Theory]
    [InlineData("Make")]
    [InlineData("1make")]
    [InlineData("make-model")]
    public void Validate_rejects_field_keys_that_are_not_snake_case(string key)
    {
        var fields = new List<ProductFieldDefinition> { Field(key) };

        Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
    }

    [Fact]
    public void Validate_rejects_an_unknown_field_type()
    {
        var fields = new List<ProductFieldDefinition> { Field("amount", type: "currency") };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
        Assert.Contains("unknown type 'currency'", ex.Message);
    }

    [Fact]
    public void Validate_rejects_an_unknown_role()
    {
        var fields = new List<ProductFieldDefinition> { Field("plate", role: "vehicle_colour") };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
        Assert.Contains("unknown role 'vehicle_colour'", ex.Message);
    }

    [Fact]
    public void Validate_rejects_the_same_role_on_two_fields()
    {
        var fields = new List<ProductFieldDefinition>
        {
            Field("reg_1", role: "vehicle_registration"),
            Field("reg_2", role: "vehicle_registration")
        };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
        Assert.Contains("used by more than one field", ex.Message);
    }

    [Fact]
    public void Validate_rejects_a_select_field_without_options()
    {
        var fields = new List<ProductFieldDefinition>
        {
            Field("cover", type: "select", validation: new FieldValidation(null, null, null, []))
        };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
        Assert.Contains("needs at least one option", ex.Message);
    }

    [Fact]
    public void Validate_rejects_an_invalid_regex_pattern()
    {
        var fields = new List<ProductFieldDefinition>
        {
            Field("reg", validation: new FieldValidation("([A-Z", null, null, null))
        };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
        Assert.Contains("invalid pattern", ex.Message);
    }

    [Fact]
    public void Validate_rejects_a_minimum_greater_than_the_maximum()
    {
        var fields = new List<ProductFieldDefinition>
        {
            Field("year", type: "number", validation: new FieldValidation(null, 2025, 2000, null))
        };

        Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate(fields, [], Registry));
    }

    [Fact]
    public void Validate_rejects_an_action_the_backend_does_not_implement()
    {
        var actions = new List<ActionDefinition> { Action("BUREAU_PULL", 1) };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate([], actions, Registry));
        Assert.Contains("'BUREAU_PULL' is not implemented", ex.Message);
    }

    [Fact]
    public void Validate_rejects_two_actions_with_the_same_order()
    {
        var actions = new List<ActionDefinition>
        {
            Action(ActionCodes.CibilCheck, 1),
            Action(ActionCodes.VahanCheck, 1)
        };

        var ex = Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate([], actions, Registry));
        Assert.Contains("share the order 1", ex.Message);
    }

    [Fact]
    public void Validate_rejects_an_action_order_below_one()
    {
        var actions = new List<ActionDefinition> { Action(ActionCodes.CibilCheck, 0) };

        Assert.Throws<BusinessRuleException>(() => ProductTypeRules.Validate([], actions, Registry));
    }

    [Fact]
    public void NormalizeCode_trims_and_uppercases()
    {
        Assert.Equal("USED_CV", ProductTypeRules.NormalizeCode("  used_cv "));
    }

    [Theory]
    [InlineData("A")]
    [InlineData("1CV")]
    [InlineData("USED-CV")]
    [InlineData("")]
    public void NormalizeCode_rejects_codes_that_are_not_upper_snake_case(string code)
    {
        Assert.Throws<BusinessRuleException>(() => ProductTypeRules.NormalizeCode(code));
    }

    private sealed class FakeRegistry(params string[] codes) : IActionRegistry
    {
        public bool IsRegistered(string code) => codes.Contains(code);

        public IAction Resolve(string code) => throw new NotSupportedException();
    }
}

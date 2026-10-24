using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;
using RCLimit.Modules.Leads.Infrastructure.Persistence;

namespace RCLimit.Modules.Leads.UnitTests;

// Needs a database with the migrations applied up to 030. Set RCLIMIT_TEST_DB to its connection string.
// Without it the test returns early, so the normal run stays free of infrastructure.
public class LeadsPersistenceRoundTripTests
{
    private const string ConnectionVariable = "RCLIMIT_TEST_DB";

    [Fact]
    public async Task Product_type_lead_details_and_action_runs_survive_a_database_round_trip()
    {
        var connection = Environment.GetEnvironmentVariable(ConnectionVariable);
        if (string.IsNullOrWhiteSpace(connection))
            return;

        var options = new DbContextOptionsBuilder<LeadsDbContext>().UseNpgsql(connection).Options;
        var tenantId = Guid.NewGuid();
        var productTypeId = Guid.NewGuid();
        var leadId = Guid.NewGuid();

        await using (var write = new LeadsDbContext(options))
        {
            write.ProductTypes.Add(new ProductType
            {
                ProductTypeId = productTypeId,
                TenantId = tenantId,
                Code = "USED_CV",
                Label = "Used Commercial Vehicle",
                SortOrder = 1,
                IsActive = true,
                FieldSchema =
                [
                    new ProductFieldDefinition("registration_number", "Vehicle registration number", "text", true,
                        "vehicle_registration", new FieldValidation("^[A-Z0-9]+$", null, null, null)),
                    new ProductFieldDefinition("fuel_type", "Fuel type", "select", false, null,
                        new FieldValidation(null, null, null, ["DIESEL", "CNG"]))
                ],
                Actions =
                [
                    new ActionDefinition("CIBIL_CHECK", 1, new Dictionary<string, JsonElement>()),
                    new ActionDefinition("VAHAN_CHECK", 2, new Dictionary<string, JsonElement>
                    {
                        ["timeoutSeconds"] = JsonSerializer.SerializeToElement(30)
                    })
                ]
            });

            write.Leads.Add(new Lead
            {
                LeadId = leadId,
                TenantId = tenantId,
                WhatsappPhoneNumber = "9999999999",
                ProductTypeCode = "USED_CV",
                RequestedAmount = 500000m,
                ReferenceNumber = "GJ05BX6637",
                ProductDetails = new Dictionary<string, JsonElement>
                {
                    ["registration_number"] = JsonSerializer.SerializeToElement("GJ05BX6637"),
                    ["fuel_type"] = JsonSerializer.SerializeToElement("DIESEL")
                }
            });

            write.ActionExecutions.Add(new ActionExecution
            {
                ExecutionId = Guid.NewGuid(),
                TenantId = tenantId,
                LeadId = leadId,
                ProductTypeCode = "USED_CV",
                ActionCode = "CIBIL_CHECK",
                ActionOrder = 1,
                Status = ActionStatuses.Succeeded,
                RequestPayload = JsonSerializer.SerializeToElement(new { outcome = "PASSED", score = 745 }),
                ResponsePayload = JsonSerializer.SerializeToElement(new { outcome = "PASSED", score = 745, remarks = (string?)null }),
                StartedAt = DateTime.UtcNow,
                CompletedAt = DateTime.UtcNow
            });

            await write.SaveChangesAsync();
        }

        try
        {
            await using var read = new LeadsDbContext(options);

            var productType = await read.ProductTypes.AsNoTracking().SingleAsync(p => p.ProductTypeId == productTypeId);
            Assert.Equal(2, productType.FieldSchema.Count);
            Assert.Equal("vehicle_registration", productType.FieldSchema[0].Role);
            Assert.Equal(["DIESEL", "CNG"], productType.FieldSchema[1].Validation!.Options);
            Assert.Equal(["CIBIL_CHECK", "VAHAN_CHECK"], productType.Actions.OrderBy(a => a.Order).Select(a => a.Code));
            Assert.Equal(30, productType.Actions[1].Config["timeoutSeconds"].GetInt32());

            var lead = await read.Leads.AsNoTracking().SingleAsync(l => l.LeadId == leadId);
            Assert.Equal("USED_CV", lead.ProductTypeCode);
            Assert.Equal(500000m, lead.RequestedAmount);
            Assert.Equal("GJ05BX6637", lead.ReferenceNumber);
            Assert.Equal("DIESEL", lead.ProductDetails["fuel_type"].GetString());

            var run = await read.ActionExecutions.AsNoTracking().SingleAsync(a => a.LeadId == leadId);
            Assert.Equal(ActionStatuses.Succeeded, run.Status);
            Assert.Equal(745, run.ResponsePayload!.Value.GetProperty("score").GetInt32());
            Assert.Equal(JsonValueKind.Null, run.ResponsePayload.Value.GetProperty("remarks").ValueKind);
        }
        finally
        {
            await using var cleanup = new LeadsDbContext(options);
            await cleanup.ActionExecutions.Where(a => a.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.Leads.Where(l => l.TenantId == tenantId).ExecuteDeleteAsync();
            await cleanup.ProductTypes.Where(p => p.TenantId == tenantId).ExecuteDeleteAsync();
        }
    }
}

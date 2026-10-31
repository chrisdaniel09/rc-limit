using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Leads.Application.Comments;
using RCLimit.Modules.Leads.Application.Leads;

namespace RCLimit.Modules.Leads.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/leads")]
[Authorize]
public class LeadsController : ControllerBase
{
    private readonly ISender _sender;

    public LeadsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool assignedToMe = false,
        [FromQuery] string? leadStatus = null,
        [FromQuery] string? productTypeCode = null,
        [FromQuery] string? leadSource = null,
        [FromQuery] string? assignedTo = null,
        [FromQuery] DateOnly? createdFrom = null,
        [FromQuery] DateOnly? createdTo = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = PageQuery.DefaultPageSize,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? search = null)
    {
        var paging = new PageQuery(page, pageSize, sortBy, sortDir, search);
        static string[] Set(string? csv) => (csv ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var filter = new LeadListFilter(assignedToMe, Set(leadStatus), productTypeCode, Set(leadSource), assignedTo, createdFrom, createdTo);
        var result = await _sender.Send(new GetLeadsQuery(filter, paging));
        return Ok(new HateoasResponse<object>
        {
            Data = result.Items,
            Meta = new PageMeta(result.Page, result.PageSize, result.TotalCount, result.TotalPages),
            Links =
            [
                new("/api/v1/leads", "self", "GET"),
                new("/api/v1/leads", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLeadCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/leads/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new("/api/v1/leads", "list", "GET"),
                new("/api/v1/loans", "create-loan", "POST"),
            ]
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _sender.Send(new GetLeadDetailQuery(id));

        var links = new List<HateoasLink>
        {
            new("/api/v1/leads", "list", "GET"),
            new($"/api/v1/leads/{id}", "self", "GET"),
        };

        // Add edit and convert links only if lead is not locked
        if (!result.IsLocked)
        {
            links.Add(new($"/api/v1/leads/{id}", "edit", "PUT"));
            links.Add(new($"/api/v1/leads/{id}/convert", "convert", "POST"));
            links.Add(new($"/api/v1/leads/{id}/conversion-preview", "conversion-preview", "GET"));
        }

        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links = links
        });
    }

    [HttpPut("{id}/assign")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignLeadRequest request)
    {
        await _sender.Send(new AssignLeadCommand(id, request.AssigneeUserId));
        return Ok(new HateoasResponse<object>
        {
            Data = new { message = "Lead assigned successfully" },
            Links = [new($"/api/v1/leads/{id}", "get", "GET")]
        });
    }

    [HttpPut("{id}/status")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        await _sender.Send(new UpdateLeadStatusCommand(id, request.Status));
        return Ok(new HateoasResponse<object>
        {
            Data = new { message = "Lead status updated successfully" },
            Links = [new($"/api/v1/leads/{id}", "get", "GET")]
        });
    }

    [HttpPost("{id}/checks")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> RecordCheck(Guid id, [FromBody] RecordCheckRequest request)
    {
        await _sender.Send(new RecordLeadCheckCommand(id, request.CheckType, request.Status, request.Score, request.Remarks));
        return Ok(new HateoasResponse<object>
        {
            Data = new { message = "Check recorded successfully" },
            Links = [new($"/api/v1/leads/{id}", "get", "GET")]
        });
    }

    [HttpGet("{id}/conversion-preview")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> GetConversionPreview(Guid id, [FromQuery] Guid? customerId = null)
    {
        var result = await _sender.Send(new GetLeadConversionPreviewQuery(id, customerId));
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/leads/{id}", "lead", "GET"),
                new($"/api/v1/leads/{id}/convert", "convert", "POST"),
            ]
        });
    }

    // Body maps action code to that action's request, e.g. { "CIBIL_CHECK": { "outcome": "PASSED", "score": 745 } }.
    [HttpPost("{id}/actions")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> RunActions(Guid id, [FromBody] Dictionary<string, JsonElement>? requests)
    {
        var results = await _sender.Send(new RunLeadActionsCommand(id, requests));
        return Ok(new HateoasResponse<object>
        {
            Data = results,
            Links =
            [
                new($"/api/v1/leads/{id}", "self", "GET"),
                new("/api/v1/leads", "list", "GET"),
            ]
        });
    }

    [HttpPost("{id}/convert")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> ConvertToCustomer(Guid id, [FromBody] ConvertRequest request)
    {
        var customerId = await _sender.Send(new ConvertLeadToCustomerCommand(
            id,
            request.CustomerType,
            request.AssignedCeiling,
            request.ExistingCustomerId,
            request.ConfirmVehicleTransfer,
            request.MaxPendingRcAllowed ?? 5,
            request.ConflictDecisions));

        return Created($"/api/v1/customers/{customerId}", new HateoasResponse<object>
        {
            Data = new { customerId },
            Links =
            [
                new("/api/v1/leads", "list", "GET"),
                new($"/api/v1/customers/{customerId}", "view-customer", "GET"),
            ]
        });
    }


    [HttpGet("{id}/comments")]
    public async Task<IActionResult> GetComments(Guid id)
    {
        var result = await _sender.Send(new GetLeadCommentsQuery(id));
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/leads/{id}", "lead", "GET"),
                new($"/api/v1/leads/{id}/comments", "add", "POST"),
            ]
        });
    }

    [HttpPost("{id}/comments")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] AddCommentRequest request)
    {
        await _sender.Send(new AddLeadCommentCommand(id, request.Text));
        return Created($"/api/v1/leads/{id}/comments", new HateoasResponse<object>
        {
            Data = new { message = "Comment added successfully" },
            Links = [new($"/api/v1/leads/{id}/comments", "list", "GET")]
        });
    }
}

public record AssignLeadRequest(Guid? AssigneeUserId);
public record AddCommentRequest(string Text);
public record UpdateStatusRequest(string Status);
public record RecordCheckRequest(string CheckType, string Status, int? Score, string? Remarks);
// ConflictDecisions maps a vehicle role to "LEAD" (use the lead's value) or "VEHICLE" (keep the vehicle's value).
public record ConvertRequest(
    string? CustomerType = null,
    decimal? AssignedCeiling = null,
    Guid? ExistingCustomerId = null,
    bool ConfirmVehicleTransfer = false,
    int? MaxPendingRcAllowed = null,
    Dictionary<string, string>? ConflictDecisions = null);

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Loans.Application.Leads;
using RCLimit.Modules.Loans.Application.Comments;
using RCLimit.Modules.Loans.Domain.ValueObjects;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

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
    public async Task<IActionResult> GetAll()
    {
        var result = await _sender.Send(new GetLeadsQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
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
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/leads", "list", "GET"),
                new($"/api/v1/leads/{id}", "self", "GET"),
            ]
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

    [HttpPost("{id}/convert")]
    [HasRight("leads.edit")]
    public async Task<IActionResult> ConvertToCustomer(Guid id, [FromBody] ConvertRequest request)
    {
        var customerId = await _sender.Send(new ConvertLeadToCustomerCommand(id, request.CustomerType, request.AssignedCeiling, request.MaxPendingRcAllowed ?? 5));
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
        var result = await _sender.Send(new GetCommentsQuery(CommentEntityTypes.Lead, id));
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
        await _sender.Send(new AddCommentCommand(CommentEntityTypes.Lead, id, request.Text));
        return Created($"/api/v1/leads/{id}/comments", new HateoasResponse<object>
        {
            Data = new { message = "Comment added successfully" },
            Links = [new($"/api/v1/leads/{id}/comments", "list", "GET")]
        });
    }
}

public record AssignLeadRequest(Guid? AssigneeUserId);
public record UpdateStatusRequest(string Status);
public record RecordCheckRequest(string CheckType, string Status, int? Score, string? Remarks);
public record ConvertRequest(string CustomerType, decimal AssignedCeiling, int? MaxPendingRcAllowed);
public record AddCommentRequest(string Text);

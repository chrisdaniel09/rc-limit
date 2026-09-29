using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Loans.Application.Leads;

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
}

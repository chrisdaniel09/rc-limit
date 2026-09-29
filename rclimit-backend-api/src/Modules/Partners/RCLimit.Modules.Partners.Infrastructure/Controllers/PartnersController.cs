using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Partners.Application.Commands;
using RCLimit.Modules.Partners.Application.Queries;

namespace RCLimit.Modules.Partners.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/partners")]
[Authorize]
public class PartnersController : ControllerBase
{
    private readonly ISender _sender;

    public PartnersController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _sender.Send(new GetPartnersQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/partners", "self", "GET"),
                new("/api/v1/partners", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePartnerCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/partners/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new("/api/v1/partners", "list", "GET"),
            ]
        });
    }
}

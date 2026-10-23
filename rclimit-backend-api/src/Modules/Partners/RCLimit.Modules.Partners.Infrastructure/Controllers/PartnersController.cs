using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Paging;
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
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = PageQuery.DefaultPageSize,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? search = null)
    {
        var paging = new PageQuery(page, pageSize, sortBy, sortDir, search);
        var result = await _sender.Send(new GetPartnersQuery(status, paging));
        return Ok(new HateoasResponse<object>
        {
            Data = result.Items,
            Meta = new PageMeta(result.Page, result.PageSize, result.TotalCount, result.TotalPages),
            Links =
            [
                new("/api/v1/partners", "self", "GET"),
                new("/api/v1/partners", "create", "POST"),
                new("/api/v1/partners/lookup", "lookup", "GET"),
            ]
        });
    }

    [HttpGet("lookup")]
    public async Task<IActionResult> GetLookup()
    {
        var result = await _sender.Send(new GetPartnerLookupQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links = [new("/api/v1/partners/lookup", "self", "GET")]
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

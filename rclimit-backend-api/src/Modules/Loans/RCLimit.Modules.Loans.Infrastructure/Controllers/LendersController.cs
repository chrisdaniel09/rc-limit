using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Loans.Application.Lenders;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/lenders")]
[Authorize]
public class LendersController : ControllerBase
{
    private readonly ISender _sender;

    public LendersController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _sender.Send(new GetLendersQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/lenders", "self", "GET"),
                new("/api/v1/lenders", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLenderCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/lenders/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new("/api/v1/lenders", "list", "GET"),
                new($"/api/v1/bank-pools?lenderId={id}", "bank-pools", "GET"),
            ]
        });
    }
}

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Loans.Application.LenderDisbursedToOptions;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/lender-disbursed-to-options")]
[Authorize]
public class LenderDisbursedToOptionsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await sender.Send(new GetLenderDisbursedToOptionsQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/lender-disbursed-to-options", "self", "GET"),
                new("/api/v1/lender-disbursed-to-options", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLenderDisbursedToOptionRequest request)
    {
        var result = await sender.Send(new CreateLenderDisbursedToOptionCommand(
            request.Code, request.Label, request.SortOrder));
        return Created($"/api/v1/lender-disbursed-to-options/{result.OptionId}", new HateoasResponse<LenderDisbursedToOptionDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/lender-disbursed-to-options", "list", "GET"),
            ]
        });
    }
}

public record CreateLenderDisbursedToOptionRequest(string Code, string Label, int SortOrder);

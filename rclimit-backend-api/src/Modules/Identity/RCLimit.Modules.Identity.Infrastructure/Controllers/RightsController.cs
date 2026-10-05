using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Identity.Application.Rights;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/rights")]
[Authorize]
public class RightsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetRights(CancellationToken cancellationToken)
    {
        var rights = await sender.Send(new GetRightsQuery(), cancellationToken);
        var links = new List<HateoasLink>
        {
            new("/api/v1/rights", "self", "GET")
        };
        return Ok(new HateoasResponse<object> { Data = rights, Links = links });
    }

    [HttpPost]
    [HasRight("rights.manage")]
    public async Task<IActionResult> CreateRight(CreateRightRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateRightCommand(request.Code, request.Module, request.Name, request.Description);
        var right = await sender.Send(command, cancellationToken);
        return Created($"/api/v1/rights/{right.RightId}", right);
    }

    [HttpPut("{id:guid}")]
    [HasRight("rights.manage")]
    public async Task<IActionResult> UpdateRight(Guid id, UpdateRightRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateRightCommand(id, request.Name, request.Description, request.IsActive);
        var right = await sender.Send(command, cancellationToken);
        return Ok(right);
    }

    public record CreateRightRequest(string Code, string Module, string Name, string? Description);
    public record UpdateRightRequest(string Name, string? Description, bool IsActive);
}

using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Identity.Application.Roles;
using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/roles")]
[Authorize]
public class RolesController(ISender sender) : ControllerBase
{
    [HttpGet]
    [HasRight("roles.manage")]
    public async Task<IActionResult> GetRoles(CancellationToken cancellationToken)
    {
        var roles = await sender.Send(new GetRolesQuery(), cancellationToken);
        var links = new List<HateoasLink>
        {
            new("/api/v1/roles", "self", "GET"),
            new("/api/v1/roles", "create", "POST")
        };
        return Ok(new HateoasResponse<object> { Data = roles, Links = links });
    }

    [HttpGet("{id:guid}")]
    [HasRight("roles.manage")]
    public async Task<IActionResult> GetRole(Guid id, CancellationToken cancellationToken)
    {
        var role = await sender.Send(new GetRoleQuery(id), cancellationToken);
        if (role == null) return NotFound();

        var links = new List<HateoasLink>
        {
            new($"/api/v1/roles/{id}", "self", "GET"),
            new($"/api/v1/roles/{id}", "edit", "PUT"),
            new($"/api/v1/roles/{id}/rights", "set-rights", "PUT")
        };
        return Ok(new HateoasResponse<object> { Data = role, Links = links });
    }

    [HttpPost]
    [HasRight("roles.manage")]
    public async Task<IActionResult> CreateRole(CreateRoleRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateRoleCommand(request.Code, request.Name, request.Description);
        var role = await sender.Send(command, cancellationToken);
        return Created($"/api/v1/roles/{role.RoleId}", role);
    }

    [HttpPut("{id:guid}")]
    [HasRight("roles.manage")]
    public async Task<IActionResult> UpdateRole(Guid id, UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateRoleCommand(id, request.Name, request.Description, request.IsActive);
        var role = await sender.Send(command, cancellationToken);
        return Ok(role);
    }

    [HttpPut("{id:guid}/rights")]
    [HasRight("roles.manage")]
    public async Task<IActionResult> SetRoleRights(Guid id, SetRoleRightsRequest request, CancellationToken cancellationToken)
    {
        var command = new SetRoleRightsCommand(id, request.RightIds);
        var role = await sender.Send(command, cancellationToken);
        return Ok(role);
    }

    public record CreateRoleRequest(string Code, string Name, string? Description);
    public record UpdateRoleRequest(string Name, string? Description, bool IsActive);
    public record SetRoleRightsRequest(List<Guid> RightIds);
}

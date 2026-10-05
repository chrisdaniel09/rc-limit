using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Identity.Application.Queries;
using RCLimit.Modules.Identity.Application.Users;

namespace RCLimit.Modules.Identity.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController(ISender sender) : ControllerBase
{
    [HttpGet]
    [HasRight("users.manage")]
    public async Task<IActionResult> GetAll()
    {
        var result = await sender.Send(new GetUsersQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/users", "self", "GET"),
            ]
        });
    }

    [HttpPut("{id:guid}/roles")]
    [HasRight("users.manage")]
    public async Task<IActionResult> SetUserRoles(Guid id, SetUserRolesRequest request, CancellationToken cancellationToken)
    {
        var command = new SetUserRolesCommand(id, request.RoleIds);
        var user = await sender.Send(command, cancellationToken);
        return Ok(user);
    }

    public record SetUserRolesRequest(List<Guid> RoleIds);
}

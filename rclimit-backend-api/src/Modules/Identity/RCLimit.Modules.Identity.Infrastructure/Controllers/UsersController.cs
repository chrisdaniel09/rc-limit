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

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup()
    {
        var result = await sender.Send(new GetUsersLookupQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/users/lookup", "self", "GET"),
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

    [HttpPost]
    [HasRight("users.manage")]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        var user = await sender.Send(new CreateUserCommand(
            request.Email,
            request.FullName,
            request.PhoneNumber,
            request.Password,
            request.RoleIds ?? []), cancellationToken);

        return Created($"/api/v1/users/{user.UserId}", new HateoasResponse<object>
        {
            Data = user,
            Links =
            [
                new("/api/v1/users", "list", "GET"),
                new($"/api/v1/users/{user.UserId}/password", "reset-password", "PUT"),
            ]
        });
    }

    [HttpPut("{id:guid}/password")]
    [HasRight("users.manage")]
    public async Task<IActionResult> ResetPassword(Guid id, [FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        await sender.Send(new ResetUserPasswordCommand(id, request.NewPassword), cancellationToken);
        return Ok(new HateoasResponse<object>
        {
            Data = new { message = "Password reset successfully. The user has been signed out of all sessions." },
            Links = [new("/api/v1/users", "list", "GET")]
        });
    }

    public record SetUserRolesRequest(List<Guid> RoleIds);
    public record CreateUserRequest(string Email, string FullName, string? PhoneNumber, string Password, List<Guid>? RoleIds);
    public record ResetPasswordRequest(string NewPassword);
}

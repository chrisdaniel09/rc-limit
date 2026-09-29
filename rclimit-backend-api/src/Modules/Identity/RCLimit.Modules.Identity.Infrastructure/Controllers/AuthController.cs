using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Application.Commands;
using RCLimit.Modules.Identity.Application.Queries;

namespace RCLimit.Modules.Identity.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly ISender _sender;

    public AuthController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var command = new RegisterCommand(
            request.Email,
            request.Password,
            request.FullName,
            request.PhoneNumber,
            request.TenantId);

        var result = await _sender.Send(command, ct);
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/auth/login", "login", "POST"),
            ]
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var command = new LoginCommand(request.Email, request.Password);
        var result = await _sender.Send(command, ct);
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/auth/me", "self", "GET"),
                new("/api/v1/auth/refresh", "refresh", "POST"),
                new("/api/v1/auth/logout", "logout", "POST"),
            ]
        });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var command = new RefreshTokenCommand(request.RefreshToken);
        var result = await _sender.Send(command, ct);
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/auth/me", "self", "GET"),
                new("/api/v1/auth/logout", "logout", "POST"),
            ]
        });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest request, CancellationToken ct)
    {
        var command = new LogoutCommand(request.RefreshToken);
        await _sender.Send(command, ct);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new ForbiddenException("Invalid or missing user identity.");

        var query = new GetCurrentUserQuery(userId);
        var result = await _sender.Send(query, ct);
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/auth/me", "self", "GET"),
                new("/api/v1/auth/logout", "logout", "POST"),
                new("/api/v1/auth/refresh", "refresh", "POST"),
            ]
        });
    }
}

public record RegisterRequest(string Email, string Password, string FullName, string? PhoneNumber, Guid TenantId);
public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);

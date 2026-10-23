using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Infrastructure.Auth;
using RCLimit.Modules.Identity.Application.Commands;
using RCLimit.Modules.Identity.Application.Dtos;
using RCLimit.Modules.Identity.Application.Queries;

namespace RCLimit.Modules.Identity.Infrastructure.Controllers;

/// <summary>
/// Session endpoints (spec section 6). The refresh token travels only in the HttpOnly cookie,
/// never in a response body. Refresh and logout authenticate with the cookie, so they pass the CSRF guard.
/// </summary>
[ApiController]
[Route("api/v1/auth")]
public class AuthController(
    ISender sender,
    IOptions<AuthOptions> options,
    CookieCsrfGuard csrf) : ControllerBase
{
    private const string SessionEndedMessage = "Your session has ended. Please sign in again.";

    [HttpPost("login")]
    [EnableRateLimiting("auth-login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        await csrf.EnsureAsync(HttpContext, ct);

        var result = await sender.Send(new LoginCommand(
            request.Email,
            request.Password,
            RequestHostResolver.ClientIp(HttpContext, options.Value),
            Request.Headers.UserAgent.ToString()), ct);

        SetRefreshCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
        return AuthOk(result);
    }

    [HttpPost("refresh")]
    [EnableRateLimiting("auth-refresh")]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        await csrf.EnsureAsync(HttpContext, ct);

        var raw = Request.Cookies[options.Value.CookieName];
        if (string.IsNullOrEmpty(raw))
            throw new AuthenticationFailedException(SessionEndedMessage, "AUTH_SESSION_MISSING");

        var result = await sender.Send(new RefreshTokenCommand(
            raw,
            RequestHostResolver.ClientIp(HttpContext, options.Value),
            Request.Headers.UserAgent.ToString()), ct);

        SetRefreshCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
        return AuthOk(result);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await csrf.EnsureAsync(HttpContext, ct);

        var raw = Request.Cookies[options.Value.CookieName];
        if (!string.IsNullOrEmpty(raw))
            await sender.Send(new LogoutCommand(raw), ct);

        ClearRefreshCookie();
        Response.Headers["Cache-Control"] = "no-store";
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new ForbiddenException("Invalid or missing user identity.");

        var result = await sender.Send(new GetCurrentUserQuery(userId), ct);
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

    private IActionResult AuthOk(AuthResponse result)
    {
        Response.Headers["Cache-Control"] = "no-store";
        return Ok(new HateoasResponse<object>
        {
            Data = new AuthBody(result.AccessToken, result.ExpiresAt, result.User),
            Links =
            [
                new("/api/v1/auth/me", "self", "GET"),
                new("/api/v1/auth/refresh", "refresh", "POST"),
                new("/api/v1/auth/logout", "logout", "POST"),
            ]
        });
    }

    /// <summary>
    /// Writes the refresh cookie as a raw Set-Cookie header so that the Partitioned attribute (Profile B)
    /// is always present regardless of framework support.
    /// </summary>
    private void SetRefreshCookie(string value, DateTime expiresAtUtc)
    {
        var expires = DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc).ToString("R", System.Globalization.CultureInfo.InvariantCulture);
        Response.Headers.Append("Set-Cookie", $"{options.Value.CookieName}={value}; Expires={expires}; {CookieAttributes()}");
    }

    private void ClearRefreshCookie()
    {
        Response.Headers.Append("Set-Cookie",
            $"{options.Value.CookieName}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; {CookieAttributes()}");
    }

    private string CookieAttributes()
    {
        var sameSite = options.Value.DeploymentProfile == DeploymentProfile.SameSite
            ? "SameSite=Strict"
            : "SameSite=None; Partitioned";

        return $"Path=/api/v1/auth; Secure; HttpOnly; {sameSite}";
    }
}

public record LoginRequest(string Email, string Password);

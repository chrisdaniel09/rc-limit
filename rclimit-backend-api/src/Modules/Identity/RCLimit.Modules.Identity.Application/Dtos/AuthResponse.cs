using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Dtos;

/// <summary>
/// Result of login or refresh inside the application layer. The refresh token is for the controller to
/// place in the HttpOnly cookie. It must never be serialised into a response body.
/// </summary>
public record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User,
    DateTime RefreshTokenExpiresAt);

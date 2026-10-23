using RCLimit.Modules.Identity.Contracts.Dtos;

namespace RCLimit.Modules.Identity.Application.Dtos;

/// <summary>JSON body of login and refresh responses. Contains no refresh token.</summary>
public record AuthBody(string AccessToken, DateTime ExpiresAt, UserDto User);

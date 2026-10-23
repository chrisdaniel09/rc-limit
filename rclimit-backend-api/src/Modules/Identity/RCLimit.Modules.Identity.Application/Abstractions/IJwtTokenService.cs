using System.Security.Claims;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Abstractions;

public interface IJwtTokenService
{
    /// <summary>Issues an RFC 9068 access token (typ: at+jwt) bound to a session family via the sid claim.</summary>
    string GenerateAccessToken(
        User user,
        Guid sessionId,
        IReadOnlyCollection<string> roleNames,
        IReadOnlyCollection<string> rightCodes,
        DateTime expiresAtUtc);

    ClaimsPrincipal? ValidateAccessToken(string token);
}

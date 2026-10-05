using System.Security.Claims;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Application.Abstractions;

public interface IJwtTokenService
{
    string GenerateAccessToken(User user, List<string>? roleNames = null, List<string>? rightCodes = null);
    string GenerateRefreshToken();
    ClaimsPrincipal? ValidateAccessToken(string token);
}

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    private const string AccessTokenType = "at+jwt";
    private const string RoleClaim = "role";
    private const string RightClaim = "right";
    private const string SessionClaim = "sid";
    private const string TenantClaim = "tenant_id";

    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateAccessToken(
        User user,
        Guid sessionId,
        IReadOnlyCollection<string> roleNames,
        IReadOnlyCollection<string> rightCodes,
        DateTime expiresAtUtc)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Name, user.FullName ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(SessionClaim, sessionId.ToString()),
            new(TenantClaim, user.TenantId.ToString()),
        };
        claims.AddRange(roleNames.Select(name => new Claim(RoleClaim, name)));
        claims.AddRange(rightCodes.Select(code => new Claim(RightClaim, code)));

        var header = new JwtHeader(credentials) { ["typ"] = AccessTokenType };
        var payload = new JwtPayload(
            _configuration["Jwt:Issuer"],
            _configuration["Jwt:Audience"],
            claims,
            notBefore: null,
            expires: expiresAtUtc,
            issuedAt: DateTime.UtcNow);

        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(header, payload));
    }

    public ClaimsPrincipal? ValidateAccessToken(string token)
    {
        var key = Encoding.UTF8.GetBytes(_configuration["Jwt:Secret"]!);

        try
        {
            return new JwtSecurityTokenHandler().ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                ValidTypes = new[] { AccessTokenType },
                ValidateIssuer = true,
                ValidIssuer = _configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = _configuration["Jwt:Audience"],
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);
        }
        catch (SecurityTokenException)
        {
            return null;
        }
    }
}

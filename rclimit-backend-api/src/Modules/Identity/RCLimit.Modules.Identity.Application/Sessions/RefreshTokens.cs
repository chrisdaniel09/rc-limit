using System.Security.Cryptography;
using System.Text;

namespace RCLimit.Modules.Identity.Application.Sessions;

/// <summary>Refresh token generation and hashing. Only the hash is ever stored.</summary>
public static class RefreshTokens
{
    /// <summary>32 CSPRNG bytes, base64url encoded without padding.</summary>
    public static string NewRawToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string Hash(string rawToken)
    {
        return Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
    }
}

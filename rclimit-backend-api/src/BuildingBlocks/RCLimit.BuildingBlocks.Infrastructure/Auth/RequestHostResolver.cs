using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using RCLimit.BuildingBlocks.Contracts.Auth;

namespace RCLimit.BuildingBlocks.Infrastructure.Auth;

/// <summary>
/// Derives the tenant host and client IP for a request, according to the deployment profile.
/// Forwarded headers are trusted only when the request came through the edge (or edge enforcement is off in Development).
/// </summary>
public static class RequestHostResolver
{
    public const string ForwardedHostHeader = "X-Forwarded-Host";
    public const string ForwardedForHeader = "X-Forwarded-For";

    /// <summary>True when the request carries the edge shared secret. Constant-time comparison.</summary>
    public static bool IsFromEdge(HttpContext context, AuthOptions options)
    {
        if (string.IsNullOrEmpty(options.Edge.SharedSecret))
            return false;
        if (!context.Request.Headers.TryGetValue(options.Edge.SharedSecretHeader, out var presented))
            return false;

        var expected = Encoding.UTF8.GetBytes(options.Edge.SharedSecret);
        var actual = Encoding.UTF8.GetBytes(presented.ToString());
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    /// <summary>
    /// The host that selects the tenant. Profile SameSite: the forwarded host set by the edge.
    /// Profile CrossSite: the host of the Origin header. The Host header is never used.
    /// </summary>
    public static string? TenantHost(HttpContext context, AuthOptions options)
    {
        if (options.DeploymentProfile == DeploymentProfile.SameSite)
        {
            if (options.EdgeEnforced && !IsFromEdge(context, options))
                return null;

            var forwarded = context.Request.Headers[ForwardedHostHeader].ToString();
            return string.IsNullOrWhiteSpace(forwarded) ? null : StripPort(forwarded);
        }

        var origin = context.Request.Headers.Origin.ToString();
        return Uri.TryCreate(origin, UriKind.Absolute, out var uri) ? uri.Host.ToLowerInvariant() : null;
    }

    /// <summary>
    /// Client IP for rate limiting and audit. Behind the edge, the first X-Forwarded-For entry is the client.
    /// </summary>
    public static string? ClientIp(HttpContext context, AuthOptions options)
    {
        if (options.EdgeEnforced && IsFromEdge(context, options))
        {
            var first = context.Request.Headers[ForwardedForHeader].ToString().Split(',')[0].Trim();
            if (first.Length > 0)
                return first;
        }

        return context.Connection.RemoteIpAddress?.ToString();
    }

    private static string StripPort(string host)
    {
        var colon = host.IndexOf(':');
        return (colon > 0 ? host[..colon] : host).ToLowerInvariant();
    }
}

namespace RCLimit.BuildingBlocks.Domain.Exceptions;

/// <summary>
/// Authentication failed (HTTP 401). Use a generic message for credential failures so the
/// response never reveals whether an account exists or is locked.
/// </summary>
public class AuthenticationFailedException : DomainException
{
    public AuthenticationFailedException(string message = "Authentication failed.", string errorCode = "AUTH_FAILED")
        : base(message, errorCode, 401) { }
}

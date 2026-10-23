using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.Modules.Identity.Application.Users;

/// <summary>
/// Password rules for every path that sets a password (spec section 8.2, NIST SP 800-63B).
/// Length only: no composition rules. Breached-password screening is not yet implemented.
/// </summary>
public static class PasswordPolicy
{
    public const int MinLength = 12;
    public const int MaxLength = 128;

    public static void Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinLength)
            throw new BusinessRuleException($"Password must be at least {MinLength} characters long.");

        if (password.Length > MaxLength)
            throw new BusinessRuleException($"Password must be at most {MaxLength} characters long.");
    }
}

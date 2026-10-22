using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.Modules.Identity.Application.Users;

public static class PasswordPolicy
{
    public const int MinLength = 8;

    public static void Validate(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < MinLength)
            throw new BusinessRuleException($"Password must be at least {MinLength} characters long.");
    }
}

using System.Text.RegularExpressions;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.BuildingBlocks.Domain.Validation;

/// <summary>
/// Rule for phone numbers stored in E.164 form: the fixed +91 country code followed by
/// a 10-digit mobile number starting with 6, 7, 8 or 9.
/// </summary>
public static class IndianMobileNumber
{
    public const string ErrorCode = "INVALID_PHONE_NUMBER";

    private static readonly Regex Pattern = new(@"^\+91[6-9][0-9]{9}$", RegexOptions.Compiled);

    public static string Validate(string? value, string fieldName)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        if (!Pattern.IsMatch(trimmed))
        {
            throw new ValidationException(
                $"{fieldName} must be a +91 mobile number: 10 digits starting with 6, 7, 8 or 9.",
                ErrorCode);
        }

        return trimmed;
    }

    // Optional fields: blank input is allowed and stored as null.
    public static string? ValidateOptional(string? value, string fieldName) =>
        string.IsNullOrWhiteSpace(value) ? null : Validate(value, fieldName);
}

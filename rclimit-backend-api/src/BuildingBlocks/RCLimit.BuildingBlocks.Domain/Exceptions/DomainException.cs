namespace RCLimit.BuildingBlocks.Domain.Exceptions;

public abstract class DomainException : Exception
{
    public string ErrorCode { get; }
    public int StatusCode { get; }

    protected DomainException(string message, string errorCode, int statusCode)
        : base(message)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
    }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string entity, object id)
        : base($"{entity} with identifier '{id}' was not found.", "NOT_FOUND", 404) { }
}

public class BusinessRuleException : DomainException
{
    public BusinessRuleException(string message, string errorCode = "BUSINESS_RULE_VIOLATION")
        : base(message, errorCode, 422) { }
}

public class ConflictException : DomainException
{
    public ConflictException(string message, string errorCode = "CONFLICT")
        : base(message, errorCode, 409) { }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "You do not have permission to perform this action.")
        : base(message, "FORBIDDEN", 403) { }
}

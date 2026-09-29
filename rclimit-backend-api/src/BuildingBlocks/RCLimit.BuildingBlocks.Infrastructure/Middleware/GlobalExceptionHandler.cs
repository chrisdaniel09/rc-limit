using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.BuildingBlocks.Infrastructure.Middleware;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var correlationId = httpContext.Items["CorrelationId"]?.ToString();
        var traceId = Activity.Current?.TraceId.ToString();

        var (statusCode, errorCode, title) = exception switch
        {
            DomainException domainEx => (domainEx.StatusCode, domainEx.ErrorCode, MapTitle(domainEx.StatusCode)),
            _ => (500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred")
        };

        if (statusCode >= 500)
        {
            logger.LogError(exception, "Unhandled exception. CorrelationId={CorrelationId}", correlationId);
        }
        else
        {
            logger.LogWarning(exception, "Domain exception {ErrorCode}: {Message}. CorrelationId={CorrelationId}",
                errorCode, exception.Message, correlationId);
        }

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = statusCode >= 500 ? "An internal error occurred. Please contact support." : exception.Message,
            Instance = httpContext.Request.Path,
            Type = $"https://errors.rclimit.in/{errorCode}"
        };

        problemDetails.Extensions["errorCode"] = errorCode;
        if (correlationId is not null)
            problemDetails.Extensions["correlationId"] = correlationId;
        if (traceId is not null)
            problemDetails.Extensions["traceId"] = traceId;

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/problem+json";
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }

    private static string MapTitle(int statusCode) => statusCode switch
    {
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        409 => "Conflict",
        422 => "Business Rule Violation",
        _ => "Server Error"
    };
}

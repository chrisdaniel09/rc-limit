using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using RCLimit.BuildingBlocks.Infrastructure.Auth;

namespace RCLimit.WebApi;

/// <summary>
/// Development only. Declares the headers the browser would normally supply (X-CSRF, and X-Forwarded-Host
/// from the dev proxy) as API-key security schemes, so Swagger UI shows them once in the Authorize dialog
/// and sends them on every request.
/// </summary>
internal sealed class DevelopmentHeadersTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        string[] headers = [CookieCsrfGuard.HeaderName, RequestHostResolver.ForwardedHostHeader];

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();

        var requirement = new OpenApiSecurityRequirement();
        foreach (var header in headers)
        {
            document.Components.SecuritySchemes[header] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.ApiKey,
                In = ParameterLocation.Header,
                Name = header,
                Description = header == CookieCsrfGuard.HeaderName
                    ? "Enter 1."
                    : "Tenant host, for example anna-finance.localhost:5173."
            };
            requirement[new OpenApiSecuritySchemeReference(header, document)] = [];
        }

        foreach (var operation in document.Paths?.Values.SelectMany(path => path.Operations ?? []) ?? [])
        {
            operation.Value.Security ??= [];
            operation.Value.Security.Add(requirement);
        }

        return Task.CompletedTask;
    }
}

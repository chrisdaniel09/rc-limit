# Observability & Logging Architecture: RCLimit Platform

This document defines the production logging strategy for the **RCLimit** C# backend deployed on Azure App Service. The design uses **Serilog** with **OpenTelemetry (OTLP)** and local file sinks to provide a zero-lock-in, cloud-agnostic observability architecture.

---

## 1. Architecture Overview

To maintain complete cloud vendor neutrality and support zero-downtime provider switching, logging follows the **OTLP Exporter Pattern**:

```
                                  ┌─> Console (App Service Live Stream)
                                  │
[ ASP.NET Core API ] ──> [ Serilog ] ──> Local File (/home/LogFiles/rclimit-api-.log)
                                  │
                                  └─> OpenTelemetry OTLP Sink
                                            │
                                            ▼ (HTTP / Protobuf)
                                 [ Remote Cloud Platform ]
                                 (New Relic / Grafana Cloud / App Insights)
```

### Core Design Principles
* **Cloud Agnostic:** The application code emits standard OTLP logs. Changing destination providers (e.g., from Grafana Cloud to New Relic) requires **zero C# code changes**—only updating Azure Environment Variables.
* **Persistent Disk Logging:** Logs are written to `/home/LogFiles/` in Azure App Service Linux to persist across container restarts while integrating with Azure Log Streaming.
* **Storage Safety:** Daily file rolling with size caps (`10 MB`) and retention limits (`7 days`) prevents storage quota exhaustion on lower App Service plans (F1/B1).

---

## 2. Dependencies & NuGet Packages

Add the required Serilog sinks to `src/WebApi/RCLimit.WebApi/RCLimit.WebApi.csproj`:

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.OpenTelemetry
dotnet add package Serilog.Enrichers.Environment
dotnet add package Serilog.Enrichers.Thread
```

---

## 3. C# Implementation (`Program.cs`)

This implementation retains the two-stage bootstrap logger pattern while dynamically configuring file and OTLP sinks:

```csharp
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting RCLimit API");

    var builder = WebApplication.CreateBuilder(args);

    // Read connection strings or overrides
    var envConn = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    if (!string.IsNullOrEmpty(envConn))
    {
        builder.Configuration["ConnectionStrings:DefaultConnection"] = envConn;
    }

    // Configure Serilog Pipeline
    builder.Host.UseSerilog((context, services, configuration) =>
    {
        configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithThreadId()
            .WriteTo.Console()
            // 1. Persistent Local / Azure Disk File Sink
            .WriteTo.File(
                path: "/home/LogFiles/rclimit-api-.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                fileSizeLimitBytes: 10_000_000, // 10 MB limit per file
                rollOnFileSizeLimit: true,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{CorrelationId}] {Message:lj}{NewLine}{Exception}"
            );

        // 2. Cloud-Agnostic OTLP Exporter Sink
        var otlpEndpoint = context.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        if (!string.IsNullOrEmpty(otlpEndpoint))
        {
            configuration.WriteTo.OpenTelemetry(options =>
            {
                options.Endpoint = otlpEndpoint;
                options.Protocol = Serilog.Sinks.OpenTelemetry.OtlpProtocol.HttpProtobuf;

                // Parse key=value pairs or Authorization headers
                var headers = context.Configuration["OTEL_EXPORTER_OTLP_HEADERS"];
                if (!string.IsNullOrEmpty(headers))
                {
                    options.Headers = headers
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(h => h.Split('=', 2))
                        .Where(pair => pair.Length == 2)
                        .ToDictionary(pair => pair[0].Trim(), pair => pair[1].Trim());
                }
            });
        }
    });

    var app = builder.Build();

    // Middleware Pipeline
    app.UseSerilogRequestLogging();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseMiddleware<TenantMiddleware>();

    app.MapControllers();
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "RCLimit API terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
```

---

## 4. Azure App Service Configuration

Configure target destinations in **Azure Portal > App Services > rclimit > Environment variables**:

### Destination Option A: New Relic (100 GB / month Free)
* **`OTEL_EXPORTER_OTLP_ENDPOINT`**: `https://otlp.nr-data.net:4318/v1/logs`
* **`OTEL_EXPORTER_OTLP_HEADERS`**: `api-key=YOUR_NEW_RELIC_LICENSE_KEY`

### Destination Option B: Grafana Cloud (50 GB / month Free)
* **`OTEL_EXPORTER_OTLP_ENDPOINT`**: `https://otlp-gateway-prod-us-central-0.grafana.net/otlp/v1/logs`
* **`OTEL_EXPORTER_OTLP_HEADERS`**: `Authorization=Basic <BASE64_TOKEN>`

### Destination Option C: Azure Application Insights
* **`APPLICATIONINSIGHTS_CONNECTION_STRING`**: `InstrumentationKey=...;IngestionEndpoint=...`

---

## 5. File Log Storage & Azure Integration

1. **Path Isolation:** Files stored in `/home/LogFiles/` persist across container restarts on Azure App Service Linux.
2. **Azure Log Stream:** Disk logs and console outputs automatically flow into **Azure Portal > App Service Logs > Log Stream**.
```
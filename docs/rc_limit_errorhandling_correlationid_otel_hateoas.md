## 1. Correlation ID Architecture
While OpenTelemetry automatically manages internal distributed TraceIds, a CorrelationId serves as a business-facing tracking identifier passed across client requests, API gateways, external webhooks (like WhatsApp), and support tickets.
```Plaintext
[Client / UI / Webhook]
  │
  ├── Header: X-Correlation-ID: "corr-8f92-4a0b"
  │   (If missing, Middleware generates new UUID)
  ▼
[CorrelationIdMiddleware]
  │
  ├── 1. Assigns HttpContext.Items["CorrelationId"]
  ├── 2. Injects into Serilog PushProperty("CorrelationId")
  ├── 3. Sets OpenTelemetry Tag ("app.correlation_id")
  ├── 4. Binds to Response Header: X-Correlation-ID
  ▼
[API Response / ProblemDetails JSON / Audit Logs]
```
## A. Correlation ID Middleware (BuildingBlocks.Infrastructure)

## B. Enriching RFC 7807 ProblemDetails & Accounting Audits
When an exception occurs, the GlobalExceptionHandler includes both the OpenTelemetry traceId and the business correlationId in the JSON response:

```Json
{
  "type": "https://errors.rclimit.in/SUB_LIMIT_EXCEEDED",
  "title": "Sub-limit ceiling exceeded",
  "status": 422,
  "detail": "Loan request of ₹25,00,000.00 exceeds available credit headroom of ₹5,00,000.00.",
  "instance": "/api/v1/loans/disburse",
  "errorCode": "SUB_LIMIT_EXCEEDED",
  "correlationId": "corr-8f92-4a0b-93e1",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

## 2. HATEOAS (Hypermedia Links in API Responses)
HATEOAS enables client applications (React SPA, mobile apps, or external sub-broker portals) to discover allowable state transitions dynamically without hardcoding URL structures.

## A. Generic HATEOAS Data Contracts (BuildingBlocks.Contracts)

## B. Loan Disbursal HATEOAS Contract Example
For an active vehicle loan, HATEOAS links dynamically change depending on the loan status, RC aging, and stop_supply_flag status:

## C. Dynamic Link Builder Service

## 3. Sample HATEOAS JSON Response Payload
```Json
{
  "loanId": "018f924a-0000-7000-8000-000000000001",
  "serialNumber": "DISB-2026-0089",
  "registrationNumber": "GJ05BX6637",
  "sanctionedAmount": 1500000.00,
  "netDisbursedAmount": 1475000.00,
  "status": "DISBURSED_RC_PENDING",
  "stopSupplyTriggered": false,
  "_links": [
    {
      "href": "https://api.rclimit.in/api/v1/loans/018f924a-0000-7000-8000-000000000001",
      "rel": "self",
      "method": "GET"
    },
    {
      "href": "https://api.rclimit.in/api/v1/loans/018f924a-0000-7000-8000-000000000001/rc-proof",
      "rel": "upload-rc-proof",
      "method": "POST"
    },
    {
      "href": "https://api.rclimit.in/api/v1/loans/018f924a-0000-7000-8000-000000000001/line-items",
      "rel": "disbursal-line-items",
      "method": "GET"
    },
    {
      "href": "https://api.rclimit.in/api/v1/accounting/journals/reference/018f924a-0000-7000-8000-000000000001",
      "rel": "journal-entry",
      "method": "GET"
    }
  ]
}
```

## 4. Pipeline Execution Order (Program.cs)
```C#
var app = builder.Build();

// 1. Exception Handler (Catches all uncaught errors)
app.UseExceptionHandler();

// 2. Correlation ID Middleware (Generates/Extracts X-Correlation-ID early)
app.UseMiddleware<CorrelationIdMiddleware>();

// 3. Serilog Request Logging (Captures HTTP method, route, status code, & CorrelationId)
app.UseSerilogRequestLogging();

// 4. Custom Context Diagnostic Enrichment (Pushes TenantId and UserId to log scope)
app.UseMiddleware<DiagnosticContextMiddleware>();

// 5. Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// 6. Map Controllers
app.MapControllers();

app.Run();
```
# Summary of System Benefits
End-to-End Tracing with X-Correlation-ID: Clients can track support queries using a human-readable header that ties together browser requests, server logs, database calls, and accounting journal audits.

Dynamic UI Capabilities with HATEOAS: The frontend dashboard (rclimit-ui) conditionally renders action buttons (e.g., "Upload RC Proof", "View Journal Entry", or "Request SLA Extension") strictly based on the presence of _links returned by the server.

## 3. Centralized Global Error Handling (rclimit-backend-api)
In ASP.NET Core 10, standard enterprise practice uses IExceptionHandler to transform internal system exceptions into RFC 7807 compliant ProblemDetails responses while maintaining trace context.

## A. Domain Exception Hierarchy (BuildingBlocks.Domain)
Define domain-specific exception types that carry explicit error codes and HTTP status code mappings:

## 4. Correlation ID Middleware Architecture
A CorrelationId serves as a business-facing tracking identifier passed across client requests, API gateways, external webhooks (like WhatsApp), and support tickets.

## 5. Structured Logging Architecture (Serilog + OpenTelemetry)
Lets for now put in a file for each tenanat and rolling every days.
# Contextual Scope Enrichment Middleware
Use custom middleware to automatically enrich all downstream log statements with tenant and security context:

## 6. OpenTelemetry Distributed Tracing & Metrics Setup
Configure OpenTelemetry instrumentation in ASP.NET Core (Program.cs) to trace HTTP requests, in-memory MediatR commands, and Entity Framework Core queries (Neon DB).

## 7. HATEOAS (Hypermedia Links in API Responses)
HATEOAS enables client applications (React SPA or sub-broker portals) to discover allowable state transitions dynamically without hardcoding URL structures.
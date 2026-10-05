using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Integrations;
using RCLimit.BuildingBlocks.Infrastructure;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.BuildingBlocks.Infrastructure.Middleware;
using RCLimit.BuildingBlocks.Infrastructure.Stubs;
using RCLimit.Modules.Accounting.Infrastructure;
using RCLimit.Modules.Identity.Infrastructure;
using RCLimit.Modules.Loans.Infrastructure;
using RCLimit.Modules.Partners.Infrastructure;
using RCLimit.Modules.System.Infrastructure;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting RCLimit API");

    var builder = WebApplication.CreateBuilder(args);

    var envConn = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    Log.Information("Connection string from environment variable: {ConnectionString}", envConn);
    if (!string.IsNullOrEmpty(envConn))
        builder.Configuration["ConnectionStrings:DefaultConnection"] = envConn;

    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .Enrich.WithThreadId());

    builder.Services.AddControllers()
        .AddApplicationPart(typeof(IdentityModuleRegistration).Assembly)
        .AddApplicationPart(typeof(AccountingModuleRegistration).Assembly)
        .AddApplicationPart(typeof(LoansModuleRegistration).Assembly)
        .AddApplicationPart(typeof(PartnersModuleRegistration).Assembly)
        .AddApplicationPart(typeof(SystemModuleRegistration).Assembly);
    builder.Services.AddOpenApi(options =>
    {
        options.AddDocumentTransformer<RCLimit.WebApi.BearerSecuritySchemeTransformer>();
    });

    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
    builder.Services.AddProblemDetails();

    builder.Services.AddScoped<TenantContext>();
    builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

    builder.Services.AddScoped<IWhatsAppService, NoOpWhatsAppService>();
    builder.Services.AddScoped<IVahanService, NoOpVahanService>();

    builder.Services.AddIdentityModule(builder.Configuration);
    builder.Services.AddAccountingModule(builder.Configuration);
    builder.Services.AddLoansModule(builder.Configuration);
    builder.Services.AddPartnersModule(builder.Configuration);
    builder.Services.AddSystemModule(builder.Configuration);

    var jwtSecret = builder.Configuration["Jwt:Secret"]!;
    var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;
    var jwtAudience = builder.Configuration["Jwt:Audience"]!;

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtIssuer,
                ValidAudience = jwtAudience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.Zero
            };
        });

    builder.Services.AddSingleton<IAuthorizationHandler, HasRightHandler>();
    builder.Services.AddSingleton<IAuthorizationPolicyProvider, HasRightPolicyProvider>();
    builder.Services.AddAuthorization();

    builder.Services.AddCors(options =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? new[] { "http://localhost:5173" };

        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });

    builder.Services.AddOpenTelemetry()
        .ConfigureResource(resource => resource.AddService("RCLimit.WebApi"))
        .WithTracing(tracing => tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddConsoleExporter());

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/openapi/v1.json", "RCLimit API v1");
        });
    }

    // Pipeline order per spec
    app.UseExceptionHandler();
    app.UseCors();
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseSerilogRequestLogging();
    app.UseMiddleware<DiagnosticContextMiddleware>();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseMiddleware<TenantMiddleware>();
    app.MapControllers();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

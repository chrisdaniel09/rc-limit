using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Auth;
using RCLimit.BuildingBlocks.Contracts.Integrations;
using RCLimit.BuildingBlocks.Infrastructure;
using RCLimit.BuildingBlocks.Infrastructure.Auth;
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

    builder.Services.AddMemoryCache();

    builder.Services.AddScoped<TenantContext>();
    builder.Services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());

    builder.Services.AddScoped<IWhatsAppService, NoOpWhatsAppService>();
    builder.Services.AddScoped<IVahanService, NoOpVahanService>();

    var tenantResolutionOptions = new TenantResolutionOptions
    {
        BaseDomains = builder.Configuration.GetSection("Tenancy:BaseDomains").Get<List<string>>() ?? []
    };
    builder.Services.AddSingleton(tenantResolutionOptions);

    builder.Services.AddIdentityModule(builder.Configuration);
    builder.Services.AddAccountingModule(builder.Configuration);
    builder.Services.AddLoansModule(builder.Configuration);
    builder.Services.AddPartnersModule(builder.Configuration);
    builder.Services.AddSystemModule(builder.Configuration);

    builder.Services.AddSingleton<ITenantDirectory, TenantDirectory>();

    // Auth configuration: bind, validate against the deployment profile, and fail fast when inconsistent.
    var authOptions = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
    authOptions.CorsAllowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    // Platform lifetime defaults come from the Jwt section (spec section 5.2).
    authOptions.Session.AccessTokenMinutes = builder.Configuration.GetValue("Jwt:AccessTokenExpirationMinutes", authOptions.Session.AccessTokenMinutes);
    authOptions.Session.IdleTimeoutDays = builder.Configuration.GetValue("Jwt:RefreshTokenExpirationDays", authOptions.Session.IdleTimeoutDays);
    var authErrors = authOptions.Validate(builder.Environment.IsDevelopment(), builder.Configuration["Jwt:Secret"]);
    if (authErrors.Count > 0)
        throw new InvalidOperationException("Invalid auth configuration: " + string.Join(" ", authErrors));

    builder.Services.AddSingleton(Microsoft.Extensions.Options.Options.Create(authOptions));
    builder.Services.AddScoped<CookieCsrfGuard>();

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
                ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                ValidTypes = new[] { "at+jwt" },
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
        options.AddDefaultPolicy(policy =>
        {
            policy.AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
                .SetIsOriginAllowedToAllowWildcardSubdomains();
        });
    });

    builder.Services.AddSingleton<ICorsPolicyProvider>(sp =>
        new TenantAwareCorsPolicy(
            sp.GetRequiredService<ITenantDirectory>(),
            sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<AuthOptions>>()));

    builder.Services.AddOpenTelemetry()
        .ConfigureResource(resource => resource.AddService("RCLimit.WebApi"))
        .WithTracing(tracing => tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddConsoleExporter());

    // Rate limits for credential endpoints (spec section 8.1). Partitioned by client IP, which is the
    // edge-supplied client address when the edge is enforced.
    builder.Services.AddRateLimiter(limiter =>
    {
        limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        limiter.AddPolicy("auth-login", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            RequestHostResolver.ClientIp(context, authOptions) ?? "unknown",
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
        limiter.AddPolicy("auth-refresh", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            RequestHostResolver.ClientIp(context, authOptions) ?? "unknown",
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0
            }));
    });

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/openapi/v1.json", "RCLimit API v1");
        });
    }

    app.UseExceptionHandler();
    app.UseCors();
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseSerilogRequestLogging();
    app.UseMiddleware<DiagnosticContextMiddleware>();
    app.UseRouting();
    app.UseRateLimiter();
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

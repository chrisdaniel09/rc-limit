using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.System.Application.Abstractions;
using RCLimit.Modules.System.Application.Commands;
using RCLimit.Modules.System.Application.Theme;
using RCLimit.Modules.System.Infrastructure.Persistence;

namespace RCLimit.Modules.System.Infrastructure;

public static class SystemModuleRegistration
{
    public static IServiceCollection AddSystemModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<SystemDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<ISystemDbContext>(sp => sp.GetRequiredService<SystemDbContext>());
        services.AddSingleton<RCLimit.BuildingBlocks.Contracts.Auth.ITenantSessionPolicyProvider, TenantSessionPolicyProvider>();
        services.Configure<BrandingOptions>(configuration.GetSection(BrandingOptions.SectionName));

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(CreateTenantCommandHandler).Assembly));

        return services;
    }
}

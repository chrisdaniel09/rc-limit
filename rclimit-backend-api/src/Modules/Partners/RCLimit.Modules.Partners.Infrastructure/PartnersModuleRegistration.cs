using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.Partners.Application.Abstractions;
using RCLimit.Modules.Partners.Contracts;
using RCLimit.Modules.Partners.Infrastructure.Persistence;

namespace RCLimit.Modules.Partners.Infrastructure;

public static class PartnersModuleRegistration
{
    public static IServiceCollection AddPartnersModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<PartnersDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<IPartnersDbContext>(sp => sp.GetRequiredService<PartnersDbContext>());
        services.AddScoped<IPartnersModuleApi, PartnersModuleApi>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(IPartnersDbContext).Assembly));

        return services;
    }
}

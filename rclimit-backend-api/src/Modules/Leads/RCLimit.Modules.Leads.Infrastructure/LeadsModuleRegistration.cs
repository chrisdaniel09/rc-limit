using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Infrastructure.Actions;
using RCLimit.Modules.Leads.Contracts;
using RCLimit.Modules.Leads.Infrastructure.ModuleApis;
using RCLimit.Modules.Leads.Infrastructure.Persistence;

namespace RCLimit.Modules.Leads.Infrastructure;

public static class LeadsModuleRegistration
{
    public static IServiceCollection AddLeadsModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<LeadsDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<ILeadsDbContext>(sp => sp.GetRequiredService<LeadsDbContext>());
        services.AddScoped<ILeadsModuleApi, LeadsModuleApi>();
        services.AddLeadActions();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(ILeadsDbContext).Assembly));

        return services;
    }
}

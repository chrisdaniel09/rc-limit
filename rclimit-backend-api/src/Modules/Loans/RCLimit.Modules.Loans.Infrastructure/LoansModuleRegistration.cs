using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Contracts;
using RCLimit.Modules.Loans.Infrastructure.Persistence;

namespace RCLimit.Modules.Loans.Infrastructure;

public static class LoansModuleRegistration
{
    public static IServiceCollection AddLoansModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<LoansDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<ILoansDbContext>(sp => sp.GetRequiredService<LoansDbContext>());
        services.AddScoped<ILoansModuleApi, LoansModuleApi>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(ILoansDbContext).Assembly));

        return services;
    }
}

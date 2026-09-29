using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Commands;
using RCLimit.Modules.Accounting.Contracts;
using RCLimit.Modules.Accounting.Infrastructure.Persistence;

namespace RCLimit.Modules.Accounting.Infrastructure;

public static class AccountingModuleRegistration
{
    public static IServiceCollection AddAccountingModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AccountingDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<IAccountingDbContext>(sp => sp.GetRequiredService<AccountingDbContext>());
        services.AddScoped<IAccountingModuleApi, AccountingModuleApi>();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(typeof(PostJournalEntryCommandHandler).Assembly));

        return services;
    }
}

using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.Leads.Application.Actions;

namespace RCLimit.Modules.Leads.Infrastructure.Actions;

public static class ActionRegistration
{
    // Each action is registered under its code. Adding an action means adding a class, a keyed
    // registration here, and its code in the catalog. No other code changes.
    public static IServiceCollection AddLeadActions(this IServiceCollection services)
    {
        services.AddKeyedTransient<IAction, CibilCheckAction>(ActionCodes.CibilCheck);
        services.AddKeyedTransient<IAction, VahanCheckAction>(ActionCodes.VahanCheck);

        services.AddSingleton(new ActionCatalog(
        [
            ActionCodes.CibilCheck,
            ActionCodes.VahanCheck
        ]));
        services.AddScoped<IActionRegistry, KeyedActionRegistry>();

        return services;
    }
}

using Microsoft.Extensions.DependencyInjection;
using RCLimit.Modules.Leads.Application.Actions;

namespace RCLimit.Modules.Leads.Infrastructure.Actions;

public sealed class KeyedActionRegistry(IServiceProvider services, ActionCatalog catalog) : IActionRegistry
{
    public bool IsRegistered(string code) => catalog.Codes.Contains(code);

    public IAction Resolve(string code)
    {
        if (!IsRegistered(code))
            throw new InvalidOperationException($"No action is registered for code '{code}'.");

        return services.GetRequiredKeyedService<IAction>(code);
    }
}

namespace RCLimit.Modules.Leads.Application.Actions;

public interface IActionRegistry
{
    bool IsRegistered(string code);
    IAction Resolve(string code);
}

// Codes of every action the backend implements. Product types may only reference these.
public sealed record ActionCatalog(IReadOnlyCollection<string> Codes);

namespace RCLimit.Modules.Loans.Contracts.Customers;

// Customer data that other parts of the system (today: Leads) need. Only DTOs cross this boundary,
// so the implementation can later be replaced by an HTTP client without changing callers.
public interface ICustomersModuleApi
{
    Task<bool> ExistsAsync(Guid customerId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CustomerSummaryDto>> GetSummariesAsync(
        IReadOnlyCollection<Guid> customerIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CustomerSummaryDto>> FindByPhoneSuffixesAsync(
        IReadOnlyCollection<string> phoneSuffixes,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CustomerSummaryDto>> FindByNameWordsAsync(
        IReadOnlyCollection<string> nameWords,
        int maxResults,
        CancellationToken cancellationToken = default);

    Task<Guid> CreateFromLeadAsync(CreateCustomerFromLeadRequest request, CancellationToken cancellationToken = default);
}

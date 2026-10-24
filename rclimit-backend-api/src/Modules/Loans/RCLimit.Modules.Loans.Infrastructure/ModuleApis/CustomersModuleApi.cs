using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Contracts.Customers;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.ModuleApis;

public sealed class CustomersModuleApi(ILoansDbContext db, ITenantContext tenant) : ICustomersModuleApi
{
    public Task<bool> ExistsAsync(Guid customerId, CancellationToken cancellationToken = default) =>
        db.Customers
            .AsNoTracking()
            .AnyAsync(c => c.CustomerId == customerId && c.TenantId == tenant.TenantId, cancellationToken);

    public async Task<IReadOnlyList<CustomerSummaryDto>> GetSummariesAsync(
        IReadOnlyCollection<Guid> customerIds,
        CancellationToken cancellationToken = default)
    {
        if (customerIds.Count == 0)
            return [];

        return await db.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == tenant.TenantId && customerIds.Contains(c.CustomerId))
            .Select(c => new CustomerSummaryDto(c.CustomerId, c.LegalName, c.TradeName, c.PhoneNumber))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CustomerSummaryDto>> FindByPhoneSuffixesAsync(
        IReadOnlyCollection<string> phoneSuffixes,
        CancellationToken cancellationToken = default)
    {
        var results = new List<CustomerSummaryDto>();

        // Stored numbers are +91XXXXXXXXXX, so a suffix match on the last 10 digits identifies the customer.
        foreach (var suffix in phoneSuffixes)
        {
            var pattern = "%" + suffix;
            var hits = await db.Customers
                .AsNoTracking()
                .Where(c => c.TenantId == tenant.TenantId && c.PhoneNumber != null && EF.Functions.Like(c.PhoneNumber, pattern))
                .Select(c => new CustomerSummaryDto(c.CustomerId, c.LegalName, c.TradeName, c.PhoneNumber))
                .ToListAsync(cancellationToken);

            results.AddRange(hits);
        }

        return results;
    }

    public async Task<IReadOnlyList<CustomerSummaryDto>> FindByNameWordsAsync(
        IReadOnlyCollection<string> nameWords,
        int maxResults,
        CancellationToken cancellationToken = default)
    {
        if (nameWords.Count == 0)
            return [];

        // Every word must appear in the legal or trade name, in any order.
        var query = db.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == tenant.TenantId);

        foreach (var word in nameWords)
        {
            var pattern = ContainsPattern(word);
            query = query.Where(c =>
                EF.Functions.Like(c.LegalName.ToLower(), pattern) ||
                EF.Functions.Like((c.TradeName ?? "").ToLower(), pattern));
        }

        return await query
            .OrderBy(c => c.LegalName)
            .Take(maxResults)
            .Select(c => new CustomerSummaryDto(c.CustomerId, c.LegalName, c.TradeName, c.PhoneNumber))
            .ToListAsync(cancellationToken);
    }

    public async Task<Guid> CreateFromLeadAsync(CreateCustomerFromLeadRequest request, CancellationToken cancellationToken = default)
    {
        var customer = new Customer
        {
            CustomerId = Guid.NewGuid(),
            TenantId = tenant.TenantId,
            CustomerType = request.CustomerType,
            LegalName = request.LegalName,
            PhoneNumber = request.PhoneNumber,
            CibilScore = request.CibilScore,
            CibilTier = DetermineCibilTier(request.CibilScore)
        };

        var subLimit = new CustomerSubLimit
        {
            SubLimitId = Guid.NewGuid(),
            CustomerId = customer.CustomerId,
            AssignedCeiling = request.AssignedCeiling,
            MaxPendingRcAllowed = request.MaxPendingRcAllowed
        };

        db.Customers.Add(customer);
        db.CustomerSubLimits.Add(subLimit);
        await db.SaveChangesAsync(cancellationToken);

        return customer.CustomerId;
    }

    // Same escaping as PageQuery.ContainsPattern in BuildingBlocks.Domain: wildcards in user text match literally.
    private static string ContainsPattern(string term)
    {
        var escaped = term.ToLowerInvariant()
            .Replace(@"\", @"\\")
            .Replace("%", @"\%")
            .Replace("_", @"\_");
        return $"%{escaped}%";
    }

    private static string? DetermineCibilTier(int? score)
    {
        if (!score.HasValue)
            return null;

        return score >= 750 ? "GREEN" :
               score >= 650 ? "AMBER" :
               "RED";
    }
}

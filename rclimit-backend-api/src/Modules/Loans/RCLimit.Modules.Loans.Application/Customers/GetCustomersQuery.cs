using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Customers;

/// <summary>
/// Filters for the customers list (docs/ui_ux_specification.md §10.5). RiskStatuses and CibilTiers are sets; empty means any.
/// UtilizationBand is LOW, WARN or HIGH against the tenant's thresholds, which the caller passes (they live in the System module).
/// </summary>
public record CustomerListFilter(
    string? CustomerType = null,
    IReadOnlyList<string>? RiskStatuses = null,
    IReadOnlyList<string>? CibilTiers = null,
    bool? StopSupply = null,
    string? UtilizationBand = null,
    int WarnPct = 70,
    int DangerPct = 90);

public record GetCustomersQuery(CustomerListFilter Filter, PageQuery Paging) : IRequest<PagedResult<CustomerDto>>;

public class GetCustomersQueryHandler : IRequestHandler<GetCustomersQuery, PagedResult<CustomerDto>>
{
    private static readonly Dictionary<string, Expression<Func<Customer, object?>>> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["legalName"] = c => c.LegalName,
        ["tradeName"] = c => c.TradeName,
        ["customerType"] = c => c.CustomerType,
        ["cibilScore"] = c => c.CibilScore,
        ["riskStatus"] = c => c.RiskStatus,
    };

    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetCustomersQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<PagedResult<CustomerDto>> Handle(GetCustomersQuery request, CancellationToken cancellationToken)
    {
        var paging = request.Paging;
        var pattern = paging.SearchTerm is { } search ? PageQuery.ContainsPattern(search) : null;

        var query = _db.Customers
            .Where(c => c.TenantId == _tenant.TenantId)
            .Where(c => pattern == null
                || EF.Functions.Like(c.LegalName.ToLower(), pattern)
                || EF.Functions.Like((c.TradeName ?? "").ToLower(), pattern)
                || EF.Functions.Like((c.PhoneNumber ?? "").ToLower(), pattern));

        var f = request.Filter;
        if (!string.IsNullOrEmpty(f.CustomerType)) query = query.Where(c => c.CustomerType == f.CustomerType);
        if (f.RiskStatuses is { Count: > 0 } risks) query = query.Where(c => risks.Contains(c.RiskStatus));
        if (f.CibilTiers is { Count: > 0 } tiers) query = query.Where(c => c.CibilTier != null && tiers.Contains(c.CibilTier));
        if (f.StopSupply is { } stop) query = query.Where(c => (c.SubLimit != null && c.SubLimit.StopSupplyFlag) == stop);
        // Compared as utilization × 100 against ceiling × pct, so there is no division by a zero ceiling.
        decimal warn = Math.Clamp(f.WarnPct, 1, 100), danger = Math.Clamp(f.DangerPct, 1, 100);
        switch (f.UtilizationBand?.ToUpperInvariant())
        {
            case "LOW":
                query = query.Where(c => c.SubLimit == null || c.SubLimit.CurrentUtilization * 100 < c.SubLimit.AssignedCeiling * warn);
                break;
            case "WARN":
                query = query.Where(c => c.SubLimit != null
                    && c.SubLimit.CurrentUtilization * 100 >= c.SubLimit.AssignedCeiling * warn
                    && c.SubLimit.CurrentUtilization * 100 < c.SubLimit.AssignedCeiling * danger);
                break;
            case "HIGH":
                query = query.Where(c => c.SubLimit != null && c.SubLimit.CurrentUtilization > 0
                    && c.SubLimit.CurrentUtilization * 100 >= c.SubLimit.AssignedCeiling * danger);
                break;
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .ApplySort(paging, SortMap, ("legalName", false), c => c.CustomerId)
            .Skip(paging.Skip)
            .Take(paging.NormalizedPageSize)
            .Select(c => new CustomerDto(
                c.CustomerId,
                c.CustomerType,
                c.LegalName,
                c.TradeName,
                c.PhoneNumber,
                c.CibilScore,
                c.CibilTier,
                c.RiskStatus,
                c.SubLimit != null ? c.SubLimit.AssignedCeiling : 0,
                c.SubLimit != null ? c.SubLimit.CurrentUtilization : 0,
                c.SubLimit != null ? c.SubLimit.AssignedCeiling - c.SubLimit.CurrentUtilization : 0,
                c.SubLimit != null ? c.SubLimit.PendingRcCount : 0,
                c.SubLimit != null ? c.SubLimit.MaxPendingRcAllowed : 0,
                c.SubLimit != null && c.SubLimit.StopSupplyFlag))
            .ToListAsync(cancellationToken);

        return new PagedResult<CustomerDto>(items, paging.NormalizedPage, paging.NormalizedPageSize, total);
    }
}

using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

/// <summary>
/// Filters for the loans list and its export (docs/ui_ux_specification.md §10.7). Statuses is a set; empty means any.
/// </summary>
public record LoanListFilter(
    IReadOnlyList<string> Statuses,
    Guid? LenderId = null,
    Guid? PoolId = null,
    string? ProductType = null,
    Guid? PartnerId = null,
    Guid? CustomerId = null,
    DateOnly? DisbursedFrom = null,
    DateOnly? DisbursedTo = null,
    string? RcAging = null,
    bool? HasOpenBalance = null)
{
    public static readonly LoanListFilter None = new([]);

    public IQueryable<LoanTransaction> Apply(IQueryable<LoanTransaction> query, string? search)
    {
        if (Statuses.Count > 0) query = query.Where(l => Statuses.Contains(l.LoanStatus));
        if (LenderId is { } lender) query = query.Where(l => l.Pool.LenderId == lender);
        if (PoolId is { } pool) query = query.Where(l => l.PoolId == pool);
        if (!string.IsNullOrEmpty(ProductType)) query = query.Where(l => l.ProductType == ProductType);
        if (PartnerId is { } partner) query = query.Where(l => l.PartnerId == partner);
        if (CustomerId is { } customer) query = query.Where(l => l.CustomerId == customer);
        if (DisbursedFrom is { } from) query = query.Where(l => l.DisbursalDate >= from);
        if (DisbursedTo is { } to) query = query.Where(l => l.DisbursalDate <= to);
        if (HasOpenBalance is { } open) query = query.Where(l => open ? l.NetDisbursedAmount > 0 : l.NetDisbursedAmount == 0);

        // RC aging applies to disbursed loans only; the band is a disbursal-date range relative to today.
        if (!string.IsNullOrEmpty(RcAging) && RcAgingRules.DisbursalRange(RcAging, DateOnly.FromDateTime(DateTime.UtcNow)) is { } range)
        {
            query = query.Where(l => l.LoanStatus == LoanStatuses.Disbursed && l.DisbursalDate != null);
            if (range.From is { } f) query = query.Where(l => l.DisbursalDate >= f);
            if (range.To is { } t) query = query.Where(l => l.DisbursalDate <= t);
        }

        if (search is not null)
        {
            var pattern = PageQuery.ContainsPattern(search);
            query = query.Where(l =>
                EF.Functions.Like(l.ApplicationNumber.ToLower(), pattern)
                || EF.Functions.Like(l.Customer.LegalName.ToLower(), pattern)
                || EF.Functions.Like(l.Vehicle.RegistrationNumber.ToLower(), pattern)
                || EF.Functions.Like((l.LenderAgreementNumber ?? "").ToLower(), pattern));
        }
        return query;
    }
}

public record LoanTotals(decimal RequestedAmount, decimal SanctionedAmount, decimal NetDisbursedAmount);

public record LoanListResult(PagedResult<LoanDto> Page, LoanTotals Totals);

public record GetLoansQuery(LoanListFilter Filter, PageQuery Paging) : IRequest<LoanListResult>;

public class GetLoansQueryHandler : IRequestHandler<GetLoansQuery, LoanListResult>
{
    internal static readonly Dictionary<string, Expression<Func<LoanTransaction, object?>>> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["applicationNumber"] = l => l.ApplicationNumber,
        ["customerName"] = l => l.Customer.LegalName,
        ["loanStatus"] = l => l.LoanStatus,
        ["disbursalDate"] = l => l.DisbursalDate,
        ["requestedAmount"] = l => l.RequestedAmount,
        ["sanctionedAmount"] = l => l.SanctionedAmount,
        ["netDisbursedAmount"] = l => l.NetDisbursedAmount,
        ["createdAt"] = l => l.CreatedAt,
    };

    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetLoansQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<LoanListResult> Handle(GetLoansQuery request, CancellationToken cancellationToken)
    {
        var paging = request.Paging;
        var query = request.Filter.Apply(_db.LoanTransactions.Where(l => l.TenantId == _tenant.TenantId), paging.SearchTerm);

        var total = await query.CountAsync(cancellationToken);

        // Totals over the whole filter, not just this page (§10.7, §15-6).
        var sums = await query
            .GroupBy(_ => 1)
            .Select(g => new LoanTotals(
                g.Sum(l => l.RequestedAmount),
                g.Sum(l => l.SanctionedAmount ?? 0),
                g.Sum(l => l.NetDisbursedAmount)))
            .FirstOrDefaultAsync(cancellationToken) ?? new LoanTotals(0, 0, 0);

        var rows = await query
            .ApplySort(paging, SortMap, ("createdAt", true), l => l.LoanId)
            .Skip(paging.Skip)
            .Take(paging.NormalizedPageSize)
            .Select(LoanListProjection.Row)
            .ToListAsync(cancellationToken);

        var items = LoanListProjection.ToDtos(rows);
        return new LoanListResult(new PagedResult<LoanDto>(items, paging.NormalizedPage, paging.NormalizedPageSize, total), sums);
    }
}

// Shared by the list and the export: what to read per loan, then the in-memory RC aging fields.
public static class LoanListProjection
{
    public record LoanRow(
        Guid LoanId, string ApplicationNumber, Guid CustomerId, string CustomerName, string VehicleRegNo, string LenderName,
        string ProductType, decimal RequestedAmount, decimal? SanctionedAmount, decimal NetDisbursedAmount, decimal CustomerRate,
        decimal TotalPayoutEarned, string LoanStatus, DateOnly? DisbursalDate, string? LenderAgreementNumber);

    public static readonly Expression<Func<LoanTransaction, LoanRow>> Row = l => new LoanRow(
        l.LoanId, l.ApplicationNumber, l.CustomerId, l.Customer.LegalName, l.Vehicle.RegistrationNumber, l.Pool.Lender.Name,
        l.ProductType, l.RequestedAmount, l.SanctionedAmount, l.NetDisbursedAmount, l.CustomerRate,
        l.TotalPayoutEarned, l.LoanStatus, l.DisbursalDate, l.LenderAgreementNumber);

    public static List<LoanDto> ToDtos(IEnumerable<LoanRow> rows)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return rows.Select(r =>
        {
            int? days = r.LoanStatus == LoanStatuses.Disbursed && r.DisbursalDate is { } d ? RcAgingRules.AgingDays(d, today) : null;
            return new LoanDto(
                r.LoanId, r.ApplicationNumber, r.CustomerName, r.VehicleRegNo, r.LenderName, r.ProductType,
                r.RequestedAmount, r.SanctionedAmount, r.NetDisbursedAmount, r.CustomerRate, r.TotalPayoutEarned,
                r.LoanStatus, r.DisbursalDate, r.CustomerId, days, days is { } n ? RcAgingRules.Status(n) : null, r.LenderAgreementNumber);
        }).ToList();
    }
}

/// <summary>Every loan matching the filter, for CSV export. Capped so one request can't read the whole table.</summary>
public record GetLoansExportQuery(LoanListFilter Filter, PageQuery Paging) : IRequest<List<LoanDto>>;

public class GetLoansExportQueryHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<GetLoansExportQuery, List<LoanDto>>
{
    public const int MaxRows = 10_000;

    public async Task<List<LoanDto>> Handle(GetLoansExportQuery request, CancellationToken cancellationToken)
    {
        var rows = await request.Filter.Apply(db.LoanTransactions.Where(l => l.TenantId == tenant.TenantId), request.Paging.SearchTerm)
            .ApplySort(request.Paging, GetLoansQueryHandler.SortMap, ("createdAt", true), l => l.LoanId)
            .Take(MaxRows)
            .Select(LoanListProjection.Row)
            .ToListAsync(cancellationToken);
        return LoanListProjection.ToDtos(rows);
    }
}

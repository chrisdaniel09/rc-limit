using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// The RC Limit Ledger report: ledger entries across loans, with each loan's running balance (spec section 4.D).
// HideDirectCustomerCredits hides bank credits paid straight to a customer (decision C1). It changes the rows
// shown, not the running balances, because those already include every entry.
// Paging is server-side (docs/ui_ux_specification.md §10.9); each row stores its running balance, so a page is self-contained.
// Paging null returns every matching row (export), capped at MaxRows. Totals cover the whole filter, not just the page.
public record GetRcLedgerQuery(
    Guid? CustomerId,
    Guid? PoolId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool? HasOpenBalance,
    bool HideDirectCustomerCredits,
    string? Search = null,
    PageQuery? Paging = null) : IRequest<RcLedgerResult>;

public record RcLedgerResult(List<RcLedgerRowDto> Items, int TotalCount, decimal CreditTotal, decimal DebitTotal);

public class GetRcLedgerQueryHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<GetRcLedgerQuery, RcLedgerResult>
{
    public const int MaxRows = 10_000;

    public async Task<RcLedgerResult> Handle(GetRcLedgerQuery request, CancellationToken cancellationToken)
    {
        var query = db.DisbursalLineItems
            .Where(li => li.LoanTransaction.TenantId == tenant.TenantId);

        if (request.CustomerId is { } customerId)
            query = query.Where(li => li.LoanTransaction.CustomerId == customerId);

        if (request.PoolId is { } poolId)
            query = query.Where(li => li.LoanTransaction.PoolId == poolId);

        if (request.StartDate is { } start)
            query = query.Where(li => li.EntryDate >= start);

        if (request.EndDate is { } end)
            query = query.Where(li => li.EntryDate <= end);

        if (request.HasOpenBalance is { } open)
            query = query.Where(li => open
                ? li.LoanTransaction.NetDisbursedAmount > 0
                : li.LoanTransaction.NetDisbursedAmount == 0);

        if (request.HideDirectCustomerCredits)
            query = query.Where(li => !(li.EntryDirection == LedgerRules.Credit && li.Counterparty == LedgerRules.Customer));

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var pattern = PageQuery.ContainsPattern(request.Search.Trim());
            query = query.Where(li =>
                EF.Functions.Like(li.LoanTransaction.ApplicationNumber.ToLower(), pattern)
                || EF.Functions.Like(li.LoanTransaction.Customer.LegalName.ToLower(), pattern)
                || EF.Functions.Like(li.LoanTransaction.Vehicle.RegistrationNumber.ToLower(), pattern));
        }

        var total = await query.CountAsync(cancellationToken);
        var sums = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Credit = g.Sum(li => li.EntryDirection == LedgerRules.Credit ? li.Amount : 0),
                Debit = g.Sum(li => li.EntryDirection == LedgerRules.Debit ? li.Amount : 0),
            })
            .FirstOrDefaultAsync(cancellationToken);

        var ordered = query
            .OrderBy(li => li.EntryDate)
            .ThenBy(li => li.CreatedAt)
            .ThenBy(li => li.LineItemId);
        var paged = request.Paging is { } paging
            ? ordered.Skip(paging.Skip).Take(paging.NormalizedPageSize)
            : ordered.Take(MaxRows);

        var rows = await paged
            .Select(li => new
            {
                li.LineItemId,
                li.LoanId,
                li.EntryDate,
                li.EntryDirection,
                li.Counterparty,
                li.ParticularType,
                li.Amount,
                li.RunningBalanceAmt,
                ApplicationNumber = li.LoanTransaction.ApplicationNumber,
                CustomerName = li.LoanTransaction.Customer.LegalName,
                VehicleRegNo = li.LoanTransaction.Vehicle.RegistrationNumber,
                LenderName = li.LoanTransaction.Pool.Lender.Name,
                LoanStatus = li.LoanTransaction.LoanStatus
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r => new RcLedgerRowDto(
            r.LineItemId,
            r.LoanId,
            r.EntryDate,
            r.ApplicationNumber,
            r.CustomerName,
            r.VehicleRegNo,
            r.LenderName,
            r.LoanStatus,
            r.EntryDirection,
            r.Counterparty,
            r.ParticularType,
            r.EntryDirection == LedgerRules.Credit ? r.Amount : null,
            r.EntryDirection == LedgerRules.Debit ? r.Amount : null,
            r.RunningBalanceAmt)).ToList();
        return new RcLedgerResult(items, total, sums?.Credit ?? 0, sums?.Debit ?? 0);
    }
}

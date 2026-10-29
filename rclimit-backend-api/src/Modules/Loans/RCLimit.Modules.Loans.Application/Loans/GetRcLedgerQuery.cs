using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// The RC Limit Ledger report: ledger entries across loans, with each loan's running balance (spec section 4.D).
// HideDirectCustomerCredits hides bank credits paid straight to a customer (decision C1). It changes the rows
// shown, not the running balances, because those already include every entry.
public record GetRcLedgerQuery(
    Guid? CustomerId,
    Guid? PoolId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    bool? HasOpenBalance,
    bool HideDirectCustomerCredits) : IRequest<List<RcLedgerRowDto>>;

public class GetRcLedgerQueryHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<GetRcLedgerQuery, List<RcLedgerRowDto>>
{
    public async Task<List<RcLedgerRowDto>> Handle(GetRcLedgerQuery request, CancellationToken cancellationToken)
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

        var rows = await query
            .OrderBy(li => li.EntryDate)
            .ThenBy(li => li.CreatedAt)
            .ThenBy(li => li.LineItemId)
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

        return rows.Select(r => new RcLedgerRowDto(
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
    }
}

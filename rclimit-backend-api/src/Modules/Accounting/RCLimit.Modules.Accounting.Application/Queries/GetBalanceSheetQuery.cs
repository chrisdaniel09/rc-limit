using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;

namespace RCLimit.Modules.Accounting.Application.Queries;

public record GetBalanceSheetQuery(Guid TenantId) : IRequest<BalanceSheetDto>;

public class GetBalanceSheetQueryHandler(IAccountingDbContext db)
    : IRequestHandler<GetBalanceSheetQuery, BalanceSheetDto>
{
    public async Task<BalanceSheetDto> Handle(GetBalanceSheetQuery request, CancellationToken cancellationToken)
    {
        var raw = await db.LedgerLineItems
            .Include(l => l.LedgerAccount)
            .Where(l => l.LedgerAccount.TenantId == request.TenantId)
            .GroupBy(l => new { l.AccountId, l.LedgerAccount.AccountCode, l.LedgerAccount.AccountName, l.LedgerAccount.AccountType })
            .Select(g => new
            {
                g.Key.AccountId,
                g.Key.AccountCode,
                g.Key.AccountName,
                g.Key.AccountType,
                DebitTotal = g.Where(x => x.EntryDirection == "DEBIT").Sum(x => x.Amount),
                CreditTotal = g.Where(x => x.EntryDirection == "CREDIT").Sum(x => x.Amount)
            })
            .ToListAsync(cancellationToken);

        BalanceSheetGroupDto ToGroup(string accountType, Guid accountId, string code, string name, decimal debits, decimal credits)
        {
            var balance = accountType is "ASSET" or "EXPENSE"
                ? debits - credits
                : credits - debits;
            return new BalanceSheetGroupDto(accountId, code, name, debits, credits, balance);
        }

        var assets = raw.Where(a => a.AccountType == "ASSET")
            .Select(a => ToGroup(a.AccountType, a.AccountId, a.AccountCode, a.AccountName, a.DebitTotal, a.CreditTotal)).ToList();
        var liabilities = raw.Where(a => a.AccountType == "LIABILITY")
            .Select(a => ToGroup(a.AccountType, a.AccountId, a.AccountCode, a.AccountName, a.DebitTotal, a.CreditTotal)).ToList();
        var equity = raw.Where(a => a.AccountType == "EQUITY")
            .Select(a => ToGroup(a.AccountType, a.AccountId, a.AccountCode, a.AccountName, a.DebitTotal, a.CreditTotal)).ToList();
        var income = raw.Where(a => a.AccountType == "INCOME")
            .Select(a => ToGroup(a.AccountType, a.AccountId, a.AccountCode, a.AccountName, a.DebitTotal, a.CreditTotal)).ToList();
        var expenses = raw.Where(a => a.AccountType == "EXPENSE")
            .Select(a => ToGroup(a.AccountType, a.AccountId, a.AccountCode, a.AccountName, a.DebitTotal, a.CreditTotal)).ToList();

        return new BalanceSheetDto(
            assets, liabilities, equity, income, expenses,
            assets.Sum(a => a.Balance),
            liabilities.Sum(a => a.Balance),
            equity.Sum(a => a.Balance),
            income.Sum(a => a.Balance),
            expenses.Sum(a => a.Balance),
            assets.Sum(a => a.Balance) - liabilities.Sum(a => a.Balance) - equity.Sum(a => a.Balance));
    }
}

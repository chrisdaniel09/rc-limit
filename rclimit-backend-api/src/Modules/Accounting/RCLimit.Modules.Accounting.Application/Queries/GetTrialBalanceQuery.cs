using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;

namespace RCLimit.Modules.Accounting.Application.Queries;

public record GetTrialBalanceQuery(Guid TenantId) : IRequest<TrialBalanceDto>;

public class GetTrialBalanceQueryHandler(IAccountingDbContext db)
    : IRequestHandler<GetTrialBalanceQuery, TrialBalanceDto>
{
    public async Task<TrialBalanceDto> Handle(GetTrialBalanceQuery request, CancellationToken cancellationToken)
    {
        var lines = await db.LedgerLineItems
            .Include(l => l.LedgerAccount)
            .Where(l => l.LedgerAccount.TenantId == request.TenantId)
            .GroupBy(l => new { l.AccountId, l.LedgerAccount.AccountCode, l.LedgerAccount.AccountName, l.LedgerAccount.AccountType })
            .Select(g => new TrialBalanceLineDto(
                g.Key.AccountId,
                g.Key.AccountCode,
                g.Key.AccountName,
                g.Key.AccountType,
                g.Where(x => x.EntryDirection == "DEBIT").Sum(x => x.Amount),
                g.Where(x => x.EntryDirection == "CREDIT").Sum(x => x.Amount)))
            .ToListAsync(cancellationToken);

        return new TrialBalanceDto(
            lines,
            lines.Sum(l => l.DebitTotal),
            lines.Sum(l => l.CreditTotal));
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;

namespace RCLimit.Modules.Accounting.Application.Queries;

public record GetLedgerAccountsQuery(Guid TenantId) : IRequest<List<LedgerAccountDto>>;

public class GetLedgerAccountsQueryHandler(IAccountingDbContext db)
    : IRequestHandler<GetLedgerAccountsQuery, List<LedgerAccountDto>>
{
    public async Task<List<LedgerAccountDto>> Handle(GetLedgerAccountsQuery request, CancellationToken cancellationToken)
    {
        return await db.LedgerAccounts
            .Where(a => a.TenantId == request.TenantId)
            .Select(a => new LedgerAccountDto(
                a.AccountId,
                a.AccountCode,
                a.AccountName,
                a.AccountType,
                a.Currency,
                a.IsActive))
            .ToListAsync(cancellationToken);
    }
}

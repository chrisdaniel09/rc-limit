using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;

namespace RCLimit.Modules.Accounting.Application.Queries;

public record GetJournalEntriesQuery(Guid TenantId) : IRequest<List<JournalEntryDto>>;

public class GetJournalEntriesQueryHandler(IAccountingDbContext db)
    : IRequestHandler<GetJournalEntriesQuery, List<JournalEntryDto>>
{
    public async Task<List<JournalEntryDto>> Handle(GetJournalEntriesQuery request, CancellationToken cancellationToken)
    {
        return await db.JournalEntries
            .Where(j => j.TenantId == request.TenantId)
            .Include(j => j.LineItems)
                .ThenInclude(l => l.LedgerAccount)
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new JournalEntryDto(
                j.JournalId,
                j.EntryNumber,
                j.EntryDate,
                j.TransactionType,
                j.Narration,
                j.CreatedAt,
                j.LineItems.Select(l => new LedgerLineItemDto(
                    l.LineItemId,
                    l.AccountId,
                    l.LedgerAccount.AccountCode,
                    l.EntryDirection,
                    l.Amount)).ToList()))
            .ToListAsync(cancellationToken);
    }
}

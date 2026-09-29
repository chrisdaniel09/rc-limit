using MediatR;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Application.Commands;

public record JournalLineDto(Guid AccountId, string Direction, decimal Amount);

public record PostJournalEntryCommand(
    Guid TenantId,
    Guid ReferenceId,
    string TransactionType,
    string Narration,
    Guid CreatedByUserId,
    string PostedByRole,
    string SourceModule,
    List<JournalLineDto> Lines) : IRequest<Guid>;

public class PostJournalEntryCommandHandler(IAccountingDbContext db)
    : IRequestHandler<PostJournalEntryCommand, Guid>
{
    public async Task<Guid> Handle(PostJournalEntryCommand request, CancellationToken cancellationToken)
    {
        var debits = request.Lines.Where(l => l.Direction == "DEBIT").Sum(l => l.Amount);
        var credits = request.Lines.Where(l => l.Direction == "CREDIT").Sum(l => l.Amount);

        if (debits != credits)
            throw new InvalidOperationException(
                $"Journal entry is unbalanced: debits ({debits}) != credits ({credits})");

        var entry = new JournalEntry
        {
            TenantId = request.TenantId,
            ReferenceId = request.ReferenceId,
            TransactionType = request.TransactionType,
            Narration = request.Narration,
            CreatedByUserId = request.CreatedByUserId,
            PostedByRole = request.PostedByRole,
            SourceModule = request.SourceModule
        };

        foreach (var line in request.Lines)
        {
            entry.LineItems.Add(new LedgerLineItem
            {
                JournalId = entry.JournalId,
                AccountId = line.AccountId,
                EntryDirection = line.Direction,
                Amount = line.Amount,
                CreatedByUserId = request.CreatedByUserId
            });
        }

        db.JournalEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        return entry.JournalId;
    }
}

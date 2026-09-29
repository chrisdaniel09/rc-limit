using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Application.Abstractions;

public interface IAccountingDbContext
{
    DbSet<LedgerAccount> LedgerAccounts { get; }
    DbSet<JournalEntry> JournalEntries { get; }
    DbSet<LedgerLineItem> LedgerLineItems { get; }
    DbSet<PostingRule> PostingRules { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

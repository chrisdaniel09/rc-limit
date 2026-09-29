using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Infrastructure.Persistence;

public class AccountingDbContext(DbContextOptions<AccountingDbContext> options)
    : DbContext(options), IAccountingDbContext
{
    public DbSet<LedgerAccount> LedgerAccounts => Set<LedgerAccount>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<LedgerLineItem> LedgerLineItems => Set<LedgerLineItem>();
    public DbSet<PostingRule> PostingRules => Set<PostingRule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("accounting");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AccountingDbContext).Assembly);
    }
}

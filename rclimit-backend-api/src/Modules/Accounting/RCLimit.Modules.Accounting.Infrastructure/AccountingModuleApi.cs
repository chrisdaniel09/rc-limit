using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Commands;
using RCLimit.Modules.Accounting.Contracts;
using RCLimit.Modules.Accounting.Contracts.Dtos;

namespace RCLimit.Modules.Accounting.Infrastructure;

public class AccountingModuleApi(ISender sender, IAccountingDbContext db) : IAccountingModuleApi
{
    public async Task<Guid> PostJournalEntryAsync(PostJournalRequest request)
    {
        var command = new PostJournalEntryCommand(
            request.TenantId,
            request.ReferenceId,
            request.TransactionType,
            request.Narration,
            request.CreatedByUserId,
            request.PostedByRole,
            request.SourceModule,
            request.Lines.Select(l => new JournalLineDto(l.AccountId, l.Direction, l.Amount)).ToList());

        return await sender.Send(command);
    }

    public async Task<decimal> GetAccountBalanceAsync(Guid accountId)
    {
        var debits = await db.LedgerLineItems
            .Where(l => l.AccountId == accountId && l.EntryDirection == "DEBIT")
            .SumAsync(l => l.Amount);
        var credits = await db.LedgerLineItems
            .Where(l => l.AccountId == accountId && l.EntryDirection == "CREDIT")
            .SumAsync(l => l.Amount);
        return debits - credits;
    }

    public async Task<Guid?> GetAccountIdByCodeAsync(Guid tenantId, string accountCode)
    {
        var account = await db.LedgerAccounts
            .Where(a => a.TenantId == tenantId && a.AccountCode == accountCode)
            .Select(a => (Guid?)a.AccountId)
            .FirstOrDefaultAsync();
        return account;
    }

    public async Task PostDisbursalEntryAsync(DisbursalPostingRequest request)
    {
        var rule = await db.PostingRules
            .Where(r => r.TenantId == request.TenantId
                     && r.ParticularType == request.ParticularType
                     && r.IsActive)
            .FirstOrDefaultAsync();

        if (rule is null)
            return;

        await PostJournalEntryAsync(new PostJournalRequest(
            request.TenantId,
            request.ReferenceId,
            rule.TransactionType,
            request.Narration,
            request.CreatedByUserId,
            "SYSTEM",
            "LOANS",
            [
                new JournalLineRequest(rule.DebitAccountId, "DEBIT", request.Amount),
                new JournalLineRequest(rule.CreditAccountId, "CREDIT", request.Amount)
            ]));
    }
}

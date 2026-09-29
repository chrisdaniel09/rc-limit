using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;

namespace RCLimit.Modules.Accounting.Application.Commands;

public record UpdatePostingRuleCommand(
    Guid RuleId,
    Guid DebitAccountId,
    Guid CreditAccountId,
    string TransactionType,
    string? Description,
    bool IsActive) : IRequest<PostingRuleDto>;

public class UpdatePostingRuleCommandHandler(IAccountingDbContext db)
    : IRequestHandler<UpdatePostingRuleCommand, PostingRuleDto>
{
    public async Task<PostingRuleDto> Handle(UpdatePostingRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = await db.PostingRules.FirstAsync(r => r.RuleId == request.RuleId, cancellationToken);

        rule.DebitAccountId = request.DebitAccountId;
        rule.CreditAccountId = request.CreditAccountId;
        rule.TransactionType = request.TransactionType;
        rule.Description = request.Description;
        rule.IsActive = request.IsActive;
        rule.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        var debit = await db.LedgerAccounts.FindAsync([rule.DebitAccountId], cancellationToken);
        var credit = await db.LedgerAccounts.FindAsync([rule.CreditAccountId], cancellationToken);

        return new PostingRuleDto(
            rule.RuleId, rule.ParticularType,
            rule.DebitAccountId, debit!.AccountCode, debit.AccountName,
            rule.CreditAccountId, credit!.AccountCode, credit.AccountName,
            rule.TransactionType, rule.Description, rule.IsActive);
    }
}

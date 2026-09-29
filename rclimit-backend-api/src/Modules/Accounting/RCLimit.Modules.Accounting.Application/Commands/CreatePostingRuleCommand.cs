using MediatR;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Application.Commands;

public record CreatePostingRuleCommand(
    Guid TenantId,
    string ParticularType,
    Guid DebitAccountId,
    Guid CreditAccountId,
    string TransactionType,
    string? Description) : IRequest<PostingRuleDto>;

public class CreatePostingRuleCommandHandler(IAccountingDbContext db)
    : IRequestHandler<CreatePostingRuleCommand, PostingRuleDto>
{
    public async Task<PostingRuleDto> Handle(CreatePostingRuleCommand request, CancellationToken cancellationToken)
    {
        var rule = new PostingRule
        {
            TenantId = request.TenantId,
            ParticularType = request.ParticularType,
            DebitAccountId = request.DebitAccountId,
            CreditAccountId = request.CreditAccountId,
            TransactionType = request.TransactionType,
            Description = request.Description
        };

        db.PostingRules.Add(rule);
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

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;

namespace RCLimit.Modules.Accounting.Application.Queries;

public record GetPostingRulesQuery(Guid TenantId) : IRequest<List<PostingRuleDto>>;

public class GetPostingRulesQueryHandler(IAccountingDbContext db)
    : IRequestHandler<GetPostingRulesQuery, List<PostingRuleDto>>
{
    public async Task<List<PostingRuleDto>> Handle(GetPostingRulesQuery request, CancellationToken cancellationToken)
    {
        return await db.PostingRules
            .Include(r => r.DebitAccount)
            .Include(r => r.CreditAccount)
            .Where(r => r.TenantId == request.TenantId)
            .OrderBy(r => r.ParticularType)
            .Select(r => new PostingRuleDto(
                r.RuleId,
                r.ParticularType,
                r.DebitAccountId,
                r.DebitAccount.AccountCode,
                r.DebitAccount.AccountName,
                r.CreditAccountId,
                r.CreditAccount.AccountCode,
                r.CreditAccount.AccountName,
                r.TransactionType,
                r.Description,
                r.IsActive))
            .ToListAsync(cancellationToken);
    }
}

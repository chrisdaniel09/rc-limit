using MediatR;
using RCLimit.Modules.Accounting.Application.Abstractions;
using RCLimit.Modules.Accounting.Application.Dtos;
using RCLimit.Modules.Accounting.Domain.Entities;

namespace RCLimit.Modules.Accounting.Application.Commands;

public record CreateLedgerAccountCommand(
    Guid TenantId,
    string AccountCode,
    string AccountName,
    string AccountType,
    Guid CreatedByUserId) : IRequest<LedgerAccountDto>;

public class CreateLedgerAccountCommandHandler(IAccountingDbContext db)
    : IRequestHandler<CreateLedgerAccountCommand, LedgerAccountDto>
{
    public async Task<LedgerAccountDto> Handle(CreateLedgerAccountCommand request, CancellationToken cancellationToken)
    {
        var account = new LedgerAccount
        {
            TenantId = request.TenantId,
            AccountCode = request.AccountCode,
            AccountName = request.AccountName,
            AccountType = request.AccountType,
            CreatedByUserId = request.CreatedByUserId
        };

        db.LedgerAccounts.Add(account);
        await db.SaveChangesAsync(cancellationToken);

        return new LedgerAccountDto(
            account.AccountId,
            account.AccountCode,
            account.AccountName,
            account.AccountType,
            account.Currency,
            account.IsActive);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Accounting.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

public record AddDisbursalLineItemCommand(
    Guid LoanId,
    string ParticularType,
    string? ModeOfPayment,
    string? BankName,
    string? AccountNo,
    string? TransactionId,
    decimal DebitAmount) : IRequest<DisbursalLineItemDto>;

public class AddDisbursalLineItemCommandHandler(
    ILoansDbContext db,
    ITenantContext tenant,
    IAccountingModuleApi accounting) : IRequestHandler<AddDisbursalLineItemCommand, DisbursalLineItemDto>
{
    public async Task<DisbursalLineItemDto> Handle(AddDisbursalLineItemCommand request, CancellationToken cancellationToken)
    {
        var lastItem = await db.DisbursalLineItems
            .Where(d => d.LoanId == request.LoanId)
            .OrderByDescending(d => d.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var loan = await db.LoanTransactions
            .FirstAsync(l => l.LoanId == request.LoanId, cancellationToken);

        var lenderOption = await db.LenderDisbursedToOptions
            .FirstOrDefaultAsync(o => o.Code == loan.LenderDisbursedTo && o.IsActive, cancellationToken);

        if (lenderOption == null || !lenderOption.AllowsDisbursalLineItems)
            throw new InvalidOperationException($"Disbursal line items cannot be added for '{loan.LenderDisbursedTo}'.");

        var previousBalance = lastItem?.RunningBalanceAmt ?? loan.LenderDisbursedAmount;
        var runningBalance = previousBalance - request.DebitAmount;

        var item = new DisbursalLineItem
        {
            LineItemId = Guid.NewGuid(),
            LoanId = request.LoanId,
            ParticularType = request.ParticularType,
            ModeOfPayment = request.ModeOfPayment,
            BankName = request.BankName,
            AccountNo = request.AccountNo,
            TransactionId = request.TransactionId,
            DebitAmount = request.DebitAmount,
            RunningBalanceAmt = runningBalance
        };

        db.DisbursalLineItems.Add(item);

        loan.NetDisbursedAmount = loan.LenderDisbursedAmount - runningBalance;
        loan.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        await accounting.PostDisbursalEntryAsync(new DisbursalPostingRequest(
            tenant.TenantId,
            loan.LoanId,
            request.ParticularType,
            request.DebitAmount,
            $"{request.ParticularType} for Loan #{loan.LoanNumber ?? loan.LoanId.ToString()[..8]}",
            tenant.UserId));

        return new DisbursalLineItemDto(
            item.LineItemId,
            item.LoanId,
            item.EntryDate,
            item.ParticularType,
            item.ModeOfPayment,
            item.BankName,
            item.AccountNo,
            item.TransactionId,
            item.DebitAmount,
            item.RunningBalanceAmt);
    }
}

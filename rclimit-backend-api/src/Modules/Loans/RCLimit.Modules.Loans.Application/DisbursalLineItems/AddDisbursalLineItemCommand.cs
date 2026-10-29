using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Application.Loans;
using RCLimit.Modules.Loans.Application.Outbox;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.DisbursalLineItems;

// Records one ledger entry: a bank credit, or a debit from the Anna Finance balance (spec section 4).
// Allowed only once the loan is disbursed. The new balance is the running balance after this entry.
// The journal posting is written to the outbox in the same transaction (gaps L6 and L7).
public record AddDisbursalLineItemCommand(
    Guid LoanId,
    string EntryDirection,
    string Counterparty,
    string? ParticularType,
    string? ModeOfPayment,
    string? BankName,
    string? AccountNo,
    string? TransactionId,
    decimal Amount) : IRequest<DisbursalLineItemDto>;

public class AddDisbursalLineItemCommandHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<AddDisbursalLineItemCommand, DisbursalLineItemDto>
{
    public async Task<DisbursalLineItemDto> Handle(AddDisbursalLineItemCommand request, CancellationToken cancellationToken)
    {
        if (!LedgerRules.IsValidDirection(request.EntryDirection))
            throw new ValidationException("Entry direction must be CREDIT or DEBIT.");

        if (request.Amount <= 0)
            throw new ValidationException("Amount must be greater than zero.");

        var counterpartyActive = await db.LenderDisbursedToOptions.AnyAsync(
            o => o.TenantId == tenant.TenantId && o.Code == request.Counterparty && o.IsActive, cancellationToken);
        if (!counterpartyActive)
            throw new ValidationException($"'{request.Counterparty}' is not an active counterparty.");

        var loan = await LoanQueries.LoadDetailedAsync(db, tenant.TenantId, request.LoanId, cancellationToken);

        if (loan.LoanStatus != LoanStatuses.Disbursed)
            throw new BusinessRuleException(
                "Ledger entries can be added only after the loan is disbursed.", "LOAN_NOT_DISBURSED");

        var particularType = await ResolveParticularTypeAsync(request, cancellationToken);

        var previousBalance = await db.DisbursalLineItems
            .Where(li => li.LoanId == loan.LoanId)
            .OrderByDescending(li => li.CreatedAt)
            .ThenByDescending(li => li.LineItemId)
            .Select(li => (decimal?)li.RunningBalanceAmt)
            .FirstOrDefaultAsync(cancellationToken) ?? 0m;

        var balance = LedgerRules.Apply(previousBalance, request.EntryDirection, request.Counterparty, request.Amount);

        if (balance < 0)
            throw new BusinessRuleException(
                "This debit would take the Anna Finance balance below zero.", "NEGATIVE_BALANCE");

        var item = new DisbursalLineItem
        {
            LineItemId = Guid.NewGuid(),
            LoanId = loan.LoanId,
            EntryDate = DateOnly.FromDateTime(DateTime.UtcNow),
            EntryDirection = request.EntryDirection,
            Counterparty = request.Counterparty,
            ParticularType = particularType,
            ModeOfPayment = request.ModeOfPayment,
            BankName = request.BankName,
            AccountNo = request.AccountNo,
            TransactionId = request.TransactionId,
            Amount = request.Amount,
            RunningBalanceAmt = balance,
            CreatedByUserId = tenant.UserId
        };

        db.DisbursalLineItems.Add(item);

        loan.NetDisbursedAmount = balance;
        loan.UpdatedAt = DateTime.UtcNow;

        var payload = new JournalPostingPayload(
            tenant.TenantId,
            loan.LoanId,
            particularType,
            request.Amount,
            $"{particularType} for {loan.ApplicationNumber}",
            tenant.UserId);

        db.OutboxMessages.Add(new LoanOutboxMessage
        {
            TenantId = tenant.TenantId,
            EventType = LoanOutboxEvents.JournalPostingRequested,
            AggregateId = loan.LoanId,
            Payload = JsonSerializer.Serialize(payload)
        });

        await db.SaveAsync(cancellationToken);

        return new DisbursalLineItemDto(
            item.LineItemId,
            item.LoanId,
            item.EntryDate,
            item.EntryDirection,
            item.Counterparty,
            item.ParticularType,
            item.ModeOfPayment,
            item.BankName,
            item.AccountNo,
            item.TransactionId,
            item.Amount,
            item.RunningBalanceAmt);
    }

    // Credits always post under the bank disbursal rule. A debit must name an active particular type (gap L16).
    private async Task<string> ResolveParticularTypeAsync(AddDisbursalLineItemCommand request, CancellationToken cancellationToken)
    {
        if (request.EntryDirection == LedgerRules.Credit)
            return LedgerRules.BankDisbursalParticularType;

        if (string.IsNullOrWhiteSpace(request.ParticularType))
            throw new ValidationException("A debit needs a particular type.");

        var typeActive = await db.DisbursalParticularTypes.AnyAsync(
            p => p.TenantId == tenant.TenantId && p.Code == request.ParticularType && p.IsActive, cancellationToken);
        if (!typeActive)
            throw new ValidationException($"'{request.ParticularType}' is not an active particular type.");

        return request.ParticularType;
    }
}

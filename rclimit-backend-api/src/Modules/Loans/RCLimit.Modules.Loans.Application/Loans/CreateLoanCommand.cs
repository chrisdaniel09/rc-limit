using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;
using RCLimit.Modules.Loans.Domain.Rules;

namespace RCLimit.Modules.Loans.Application.Loans;

// Creates a loan file in NEW. Nothing is sanctioned, utilized or posted here (spec section 3).
public record CreateLoanCommand(
    Guid CustomerId,
    Guid VehicleId,
    Guid PoolId,
    Guid? PartnerId,
    string? LenderAgreementNumber,
    string ProductType,
    decimal RequestedAmount,
    decimal BankPayoutPctAmt,
    decimal BonusPayoutAmt,
    decimal SharedPayoutAmt,
    string? Remarks) : IRequest<Guid>;

public class CreateLoanCommandHandler(ILoansDbContext db, ITenantContext tenant) : IRequestHandler<CreateLoanCommand, Guid>
{
    private static readonly string[] SupportedProductTypes = ["USED_CV", "NEW_CV", "REFINANCE"];

    public async Task<Guid> Handle(CreateLoanCommand request, CancellationToken cancellationToken)
    {
        if (request.RequestedAmount <= 0)
            throw new ValidationException("Requested amount must be greater than zero.");

        if (!SupportedProductTypes.Contains(request.ProductType))
            throw new ValidationException($"Unsupported product type '{request.ProductType}'.");

        var customerExists = await db.Customers.AnyAsync(
            c => c.CustomerId == request.CustomerId && c.TenantId == tenant.TenantId, cancellationToken);
        if (!customerExists)
            throw new NotFoundException("Customer", request.CustomerId);

        var vehicle = await db.Vehicles.FirstOrDefaultAsync(
            v => v.VehicleId == request.VehicleId && v.TenantId == tenant.TenantId, cancellationToken)
            ?? throw new NotFoundException("Vehicle", request.VehicleId);

        // A loan can only be raised against a vehicle the selected customer owns today.
        if (vehicle.OwnerCustomerId != request.CustomerId)
            throw new BusinessRuleException(
                "The selected vehicle is not owned by the selected customer.", "VEHICLE_NOT_OWNED_BY_CUSTOMER");

        var poolExists = await db.MasterBankPools.AnyAsync(
            p => p.PoolId == request.PoolId && p.TenantId == tenant.TenantId, cancellationToken);
        if (!poolExists)
            throw new NotFoundException("Bank pool", request.PoolId);

        var loan = new LoanTransaction
        {
            LoanId = Guid.NewGuid(),
            TenantId = tenant.TenantId,
            ApplicationNumber = await NextApplicationNumberAsync(cancellationToken),
            LenderAgreementNumber = request.LenderAgreementNumber,
            CustomerId = request.CustomerId,
            VehicleId = request.VehicleId,
            PoolId = request.PoolId,
            PartnerId = request.PartnerId,
            ProductType = request.ProductType,
            RequestedAmount = request.RequestedAmount,
            BankPayoutPctAmt = request.BankPayoutPctAmt,
            BonusPayoutAmt = request.BonusPayoutAmt,
            SharedPayoutAmt = request.SharedPayoutAmt,
            Remarks = request.Remarks,
            CreatedByUserId = tenant.UserId,
            LoanStatus = LoanStatuses.New
        };

        db.LoanTransactions.Add(loan);
        await db.SaveAsync(cancellationToken);

        return loan.LoanId;
    }

    private async Task<string> NextApplicationNumberAsync(CancellationToken cancellationToken)
    {
        var sequence = await db.ApplicationNumberSequences
            .FirstOrDefaultAsync(s => s.TenantId == tenant.TenantId, cancellationToken);

        if (sequence is null)
        {
            sequence = new ApplicationNumberSequence { TenantId = tenant.TenantId };
            db.ApplicationNumberSequences.Add(sequence);
        }

        var number = sequence.NextValue;
        sequence.NextValue++;

        return $"APP-{DateTime.UtcNow:yyyy}-{number:D6}";
    }
}

using MediatR;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Customers;

public record CreateCustomerCommand(
    string CustomerType,
    string LegalName,
    string? TradeName,
    string? PhoneNumber,
    string? Email,
    string? PanNumber,
    string? Gstin,
    decimal AssignedCeiling,
    int MaxPendingRcAllowed = 5) : IRequest<Guid>;

public class CreateCustomerCommandHandler : IRequestHandler<CreateCustomerCommand, Guid>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public CreateCustomerCommandHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<Guid> Handle(CreateCustomerCommand request, CancellationToken cancellationToken)
    {
        var customer = new Customer
        {
            CustomerId = Guid.NewGuid(),
            TenantId = _tenant.TenantId,
            CustomerType = request.CustomerType,
            LegalName = request.LegalName,
            TradeName = request.TradeName,
            PhoneNumber = request.PhoneNumber,
            Email = request.Email,
            PanNumber = request.PanNumber,
            Gstin = request.Gstin
        };

        var subLimit = new CustomerSubLimit
        {
            SubLimitId = Guid.NewGuid(),
            CustomerId = customer.CustomerId,
            AssignedCeiling = request.AssignedCeiling,
            MaxPendingRcAllowed = request.MaxPendingRcAllowed
        };

        _db.Customers.Add(customer);
        _db.CustomerSubLimits.Add(subLimit);
        await _db.SaveChangesAsync(cancellationToken);
        return customer.CustomerId;
    }
}

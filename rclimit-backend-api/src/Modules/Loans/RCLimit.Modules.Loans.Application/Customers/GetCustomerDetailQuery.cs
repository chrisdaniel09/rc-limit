using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Customers;

public record GetCustomerDetailQuery(Guid CustomerId) : IRequest<CustomerDto?>;

public class GetCustomerDetailQueryHandler : IRequestHandler<GetCustomerDetailQuery, CustomerDto?>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetCustomerDetailQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<CustomerDto?> Handle(GetCustomerDetailQuery request, CancellationToken cancellationToken)
    {
        return await _db.Customers
            .Where(c => c.CustomerId == request.CustomerId && c.TenantId == _tenant.TenantId)
            .Include(c => c.SubLimit)
            .Select(c => new CustomerDto(
                c.CustomerId,
                c.CustomerType,
                c.LegalName,
                c.TradeName,
                c.PhoneNumber,
                c.CibilScore,
                c.CibilTier,
                c.RiskStatus,
                c.SubLimit != null ? c.SubLimit.AssignedCeiling : 0,
                c.SubLimit != null ? c.SubLimit.CurrentUtilization : 0,
                c.SubLimit != null ? c.SubLimit.AssignedCeiling - c.SubLimit.CurrentUtilization : 0,
                c.SubLimit != null ? c.SubLimit.PendingRcCount : 0,
                c.SubLimit != null ? c.SubLimit.MaxPendingRcAllowed : 0,
                c.SubLimit != null && c.SubLimit.StopSupplyFlag))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Customers;

public record GetCustomersQuery : IRequest<List<CustomerDto>>;

public class GetCustomersQueryHandler : IRequestHandler<GetCustomersQuery, List<CustomerDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetCustomersQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<CustomerDto>> Handle(GetCustomersQuery request, CancellationToken cancellationToken)
    {
        return await _db.Customers
            .Where(c => c.TenantId == _tenant.TenantId)
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
            .ToListAsync(cancellationToken);
    }
}

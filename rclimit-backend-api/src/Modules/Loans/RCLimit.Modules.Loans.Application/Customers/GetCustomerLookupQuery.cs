using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.Modules.Loans.Application.Abstractions;

namespace RCLimit.Modules.Loans.Application.Customers;

// Unpaged id + name list for dropdowns. Not for browsing; use GetCustomersQuery for that.
public record CustomerLookupDto(Guid CustomerId, string LegalName);

public record GetCustomerLookupQuery : IRequest<List<CustomerLookupDto>>;

public class GetCustomerLookupQueryHandler : IRequestHandler<GetCustomerLookupQuery, List<CustomerLookupDto>>
{
    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetCustomerLookupQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<List<CustomerLookupDto>> Handle(GetCustomerLookupQuery request, CancellationToken cancellationToken)
    {
        return await _db.Customers
            .Where(c => c.TenantId == _tenant.TenantId)
            .OrderBy(c => c.LegalName)
            .Select(c => new CustomerLookupDto(c.CustomerId, c.LegalName))
            .ToListAsync(cancellationToken);
    }
}

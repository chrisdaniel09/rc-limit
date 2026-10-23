using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Customers;

public record GetCustomersQuery(string? CustomerType, string? RiskStatus, PageQuery Paging) : IRequest<PagedResult<CustomerDto>>;

public class GetCustomersQueryHandler : IRequestHandler<GetCustomersQuery, PagedResult<CustomerDto>>
{
    private static readonly Dictionary<string, Expression<Func<Customer, object?>>> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["legalName"] = c => c.LegalName,
        ["tradeName"] = c => c.TradeName,
        ["customerType"] = c => c.CustomerType,
        ["cibilScore"] = c => c.CibilScore,
        ["riskStatus"] = c => c.RiskStatus,
    };

    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetCustomersQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<PagedResult<CustomerDto>> Handle(GetCustomersQuery request, CancellationToken cancellationToken)
    {
        var paging = request.Paging;
        var pattern = paging.SearchTerm is { } search ? PageQuery.ContainsPattern(search) : null;

        var query = _db.Customers
            .Where(c => c.TenantId == _tenant.TenantId)
            .Where(c => string.IsNullOrEmpty(request.CustomerType) || c.CustomerType == request.CustomerType)
            .Where(c => string.IsNullOrEmpty(request.RiskStatus) || c.RiskStatus == request.RiskStatus)
            .Where(c => pattern == null
                || EF.Functions.Like(c.LegalName.ToLower(), pattern)
                || EF.Functions.Like((c.TradeName ?? "").ToLower(), pattern)
                || EF.Functions.Like((c.PhoneNumber ?? "").ToLower(), pattern));

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .ApplySort(paging, SortMap, ("legalName", false), c => c.CustomerId)
            .Skip(paging.Skip)
            .Take(paging.NormalizedPageSize)
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

        return new PagedResult<CustomerDto>(items, paging.NormalizedPage, paging.NormalizedPageSize, total);
    }
}

using System.Linq.Expressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Loans;

public record GetLoansQuery(string? LoanStatus, PageQuery Paging) : IRequest<PagedResult<LoanDto>>;

public class GetLoansQueryHandler : IRequestHandler<GetLoansQuery, PagedResult<LoanDto>>
{
    private static readonly Dictionary<string, Expression<Func<LoanTransaction, object?>>> SortMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["applicationNumber"] = l => l.ApplicationNumber,
        ["customerName"] = l => l.Customer.LegalName,
        ["loanStatus"] = l => l.LoanStatus,
        ["disbursalDate"] = l => l.DisbursalDate,
        ["requestedAmount"] = l => l.RequestedAmount,
        ["sanctionedAmount"] = l => l.SanctionedAmount,
        ["netDisbursedAmount"] = l => l.NetDisbursedAmount,
        ["createdAt"] = l => l.CreatedAt,
    };

    private readonly ILoansDbContext _db;
    private readonly ITenantContext _tenant;

    public GetLoansQueryHandler(ILoansDbContext db, ITenantContext tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task<PagedResult<LoanDto>> Handle(GetLoansQuery request, CancellationToken cancellationToken)
    {
        var paging = request.Paging;
        var pattern = paging.SearchTerm is { } search ? PageQuery.ContainsPattern(search) : null;

        var query = _db.LoanTransactions
            .Where(l => l.TenantId == _tenant.TenantId)
            .Where(l => string.IsNullOrEmpty(request.LoanStatus) || l.LoanStatus == request.LoanStatus)
            .Where(l => pattern == null
                || EF.Functions.Like(l.ApplicationNumber.ToLower(), pattern)
                || EF.Functions.Like(l.Customer.LegalName.ToLower(), pattern)
                || EF.Functions.Like(l.Vehicle.RegistrationNumber.ToLower(), pattern)
                || EF.Functions.Like((l.LenderAgreementNumber ?? "").ToLower(), pattern));

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .ApplySort(paging, SortMap, ("createdAt", true), l => l.LoanId)
            .Skip(paging.Skip)
            .Take(paging.NormalizedPageSize)
            .Select(l => new LoanDto(
                l.LoanId,
                l.ApplicationNumber,
                l.Customer.LegalName,
                l.Vehicle.RegistrationNumber,
                l.Pool.Lender.Name,
                l.ProductType,
                l.RequestedAmount,
                l.SanctionedAmount,
                l.NetDisbursedAmount,
                l.CustomerRate,
                l.TotalPayoutEarned,
                l.LoanStatus,
                l.DisbursalDate))
            .ToListAsync(cancellationToken);

        return new PagedResult<LoanDto>(items, paging.NormalizedPage, paging.NormalizedPageSize, total);
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.System.Application.Abstractions;
using RCLimit.Modules.System.Application.Dtos;

namespace RCLimit.Modules.System.Application.Queries;

public record GetTenantsQuery : IRequest<List<TenantDto>>;

public class GetTenantsQueryHandler(ISystemDbContext db) : IRequestHandler<GetTenantsQuery, List<TenantDto>>
{
    public async Task<List<TenantDto>> Handle(GetTenantsQuery request, CancellationToken cancellationToken)
    {
        return await db.Tenants
            .Select(t => new TenantDto(
                t.TenantId,
                t.OrganizationName,
                t.Slug,
                t.CustomDomain,
                t.SubscriptionPlan,
                t.IsActive,
                t.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}

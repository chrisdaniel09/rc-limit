using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.System.Application.Abstractions;
using RCLimit.Modules.System.Application.Dtos;

namespace RCLimit.Modules.System.Application.Queries;

public record GetTenantByIdQuery(Guid TenantId) : IRequest<TenantDto?>;

public class GetTenantByIdQueryHandler(ISystemDbContext db) : IRequestHandler<GetTenantByIdQuery, TenantDto?>
{
    public async Task<TenantDto?> Handle(GetTenantByIdQuery request, CancellationToken cancellationToken)
    {
        return await db.Tenants
            .Where(t => t.TenantId == request.TenantId)
            .Select(t => new TenantDto(
                t.TenantId,
                t.OrganizationName,
                t.Slug,
                t.CustomDomain,
                t.SubscriptionPlan,
                t.IsActive,
                t.CreatedAt))
            .FirstOrDefaultAsync(cancellationToken);
    }
}

using MediatR;
using RCLimit.Modules.System.Application.Abstractions;
using RCLimit.Modules.System.Application.Dtos;
using RCLimit.Modules.System.Domain.Entities;

namespace RCLimit.Modules.System.Application.Commands;

public record CreateTenantCommand(
    string OrganizationName,
    string Slug,
    string? CustomDomain) : IRequest<TenantDto>;

public class CreateTenantCommandHandler(ISystemDbContext db) : IRequestHandler<CreateTenantCommand, TenantDto>
{
    public async Task<TenantDto> Handle(CreateTenantCommand request, CancellationToken cancellationToken)
    {
        var tenant = new Tenant
        {
            OrganizationName = request.OrganizationName,
            Slug = request.Slug,
            CustomDomain = request.CustomDomain
        };

        var settings = new TenantSettings { TenantId = tenant.TenantId };

        db.Tenants.Add(tenant);
        db.TenantSettings.Add(settings);
        await db.SaveChangesAsync(cancellationToken);

        return new TenantDto(
            tenant.TenantId,
            tenant.OrganizationName,
            tenant.Slug,
            tenant.CustomDomain,
            tenant.SubscriptionPlan,
            tenant.IsActive,
            tenant.CreatedAt);
    }
}

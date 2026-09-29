using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.System.Domain.Entities;

namespace RCLimit.Modules.System.Application.Abstractions;

public interface ISystemDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<TenantSettings> TenantSettings { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

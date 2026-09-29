using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.System.Application.Abstractions;
using RCLimit.Modules.System.Domain.Entities;

namespace RCLimit.Modules.System.Infrastructure.Persistence;

public class SystemDbContext(DbContextOptions<SystemDbContext> options)
    : DbContext(options), ISystemDbContext
{
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<TenantSettings> TenantSettings => Set<TenantSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("system");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SystemDbContext).Assembly);
    }
}

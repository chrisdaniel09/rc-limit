using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Identity.Application.Abstractions;
using RCLimit.Modules.Identity.Domain.Entities;

namespace RCLimit.Modules.Identity.Infrastructure.Persistence;

public class IdentityDbContext : DbContext, IIdentityDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserIdentity> UserIdentities => Set<UserIdentity>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Right> Rights => Set<Right>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<RoleRight> RoleRights => Set<RoleRight>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

    public IdentityDbContext(DbContextOptions<IdentityDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("auth");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IdentityDbContext).Assembly);
    }
}

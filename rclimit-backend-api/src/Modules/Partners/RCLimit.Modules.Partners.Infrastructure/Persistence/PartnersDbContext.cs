using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Partners.Application.Abstractions;
using RCLimit.Modules.Partners.Domain.Entities;

namespace RCLimit.Modules.Partners.Infrastructure.Persistence;

public class PartnersDbContext : DbContext, IPartnersDbContext
{
    public PartnersDbContext(DbContextOptions<PartnersDbContext> options) : base(options) { }

    public DbSet<Partner> Partners => Set<Partner>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PartnersDbContext).Assembly);
    }
}

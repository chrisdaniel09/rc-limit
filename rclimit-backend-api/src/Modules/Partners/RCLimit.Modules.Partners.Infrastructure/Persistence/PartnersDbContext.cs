using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Partners.Application.Abstractions;
using RCLimit.Modules.Partners.Domain.Entities;

namespace RCLimit.Modules.Partners.Infrastructure.Persistence;

public class PartnersDbContext : DbContext, IPartnersDbContext
{
    // Every Partners table lives in this schema.
    public const string Schema = "partners";

    public PartnersDbContext(DbContextOptions<PartnersDbContext> options) : base(options) { }

    public DbSet<Partner> Partners => Set<Partner>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PartnersDbContext).Assembly);
    }
}

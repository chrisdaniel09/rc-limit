using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Infrastructure.Persistence;

public class LeadsDbContext : DbContext, ILeadsDbContext
{
    public LeadsDbContext(DbContextOptions<LeadsDbContext> options) : base(options) { }

    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadCheckLog> LeadCheckLogs => Set<LeadCheckLog>();
    public DbSet<LeadCustomer> LeadCustomers => Set<LeadCustomer>();
    public DbSet<LeadComment> LeadComments => Set<LeadComment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LeadsDbContext).Assembly);
    }
}

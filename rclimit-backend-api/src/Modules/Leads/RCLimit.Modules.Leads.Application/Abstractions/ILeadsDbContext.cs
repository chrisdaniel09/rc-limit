using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Abstractions;

public interface ILeadsDbContext
{
    DbSet<Lead> Leads { get; }
    DbSet<LeadCheckLog> LeadCheckLogs { get; }
    DbSet<ProductType> ProductTypes { get; }
    DbSet<ActionExecution> ActionExecutions { get; }
    DbSet<LeadCustomer> LeadCustomers { get; }
    DbSet<LeadComment> LeadComments { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence;

public class LoansDbContext : DbContext, ILoansDbContext
{
    public LoansDbContext(DbContextOptions<LoansDbContext> options) : base(options) { }

    public DbSet<Lender> Lenders => Set<Lender>();
    public DbSet<MasterBankPool> MasterBankPools => Set<MasterBankPool>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerSubLimit> CustomerSubLimits => Set<CustomerSubLimit>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<LoanTransaction> LoanTransactions => Set<LoanTransaction>();
    public DbSet<DisbursalLineItem> DisbursalLineItems => Set<DisbursalLineItem>();
    public DbSet<RcPipelineTracker> RcPipelineTrackers => Set<RcPipelineTracker>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadCheckLog> LeadCheckLogs => Set<LeadCheckLog>();
    public DbSet<VerificationLog> VerificationLogs => Set<VerificationLog>();
    public DbSet<DisbursalParticularType> DisbursalParticularTypes => Set<DisbursalParticularType>();
    public DbSet<LenderDisbursedToOption> LenderDisbursedToOptions => Set<LenderDisbursedToOption>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LoansDbContext).Assembly);
    }
}

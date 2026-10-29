using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Infrastructure.Persistence;

public class LoansDbContext : DbContext, ILoansDbContext
{
    // Every Loans table lives in this schema (spec section 11.3, rule 1).
    public const string Schema = "loans";

    public LoansDbContext(DbContextOptions<LoansDbContext> options) : base(options) { }

    public DbSet<Lender> Lenders => Set<Lender>();
    public DbSet<MasterBankPool> MasterBankPools => Set<MasterBankPool>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerSubLimit> CustomerSubLimits => Set<CustomerSubLimit>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<LoanTransaction> LoanTransactions => Set<LoanTransaction>();
    public DbSet<DisbursalLineItem> DisbursalLineItems => Set<DisbursalLineItem>();
    public DbSet<RcPipelineTracker> RcPipelineTrackers => Set<RcPipelineTracker>();
    public DbSet<EntityComment> EntityComments => Set<EntityComment>();
    public DbSet<VerificationLog> VerificationLogs => Set<VerificationLog>();
    public DbSet<DisbursalParticularType> DisbursalParticularTypes => Set<DisbursalParticularType>();
    public DbSet<LenderDisbursedToOption> LenderDisbursedToOptions => Set<LenderDisbursedToOption>();
    public DbSet<PostDisbursementDocumentStatus> PostDisbursementDocumentStatuses => Set<PostDisbursementDocumentStatus>();
    public DbSet<CustomerVehicle> CustomerVehicles => Set<CustomerVehicle>();
    public DbSet<ApplicationNumberSequence> ApplicationNumberSequences => Set<ApplicationNumberSequence>();
    public DbSet<LoanOutboxMessage> OutboxMessages => Set<LoanOutboxMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LoansDbContext).Assembly);
    }
}

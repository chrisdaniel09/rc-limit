using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Abstractions;

public interface ILoansDbContext
{
    DbSet<Lender> Lenders { get; }
    DbSet<MasterBankPool> MasterBankPools { get; }
    DbSet<Customer> Customers { get; }
    DbSet<CustomerSubLimit> CustomerSubLimits { get; }
    DbSet<Vehicle> Vehicles { get; }
    DbSet<LoanTransaction> LoanTransactions { get; }
    DbSet<DisbursalLineItem> DisbursalLineItems { get; }
    DbSet<RcPipelineTracker> RcPipelineTrackers { get; }
    DbSet<Lead> Leads { get; }
    DbSet<LeadCheckLog> LeadCheckLogs { get; }
    DbSet<EntityComment> EntityComments { get; }
    DbSet<VerificationLog> VerificationLogs { get; }
    DbSet<DisbursalParticularType> DisbursalParticularTypes { get; }
    DbSet<LenderDisbursedToOption> LenderDisbursedToOptions { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

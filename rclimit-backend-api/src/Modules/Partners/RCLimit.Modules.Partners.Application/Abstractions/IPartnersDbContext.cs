using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Partners.Domain.Entities;

namespace RCLimit.Modules.Partners.Application.Abstractions;

public interface IPartnersDbContext
{
    DbSet<Partner> Partners { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

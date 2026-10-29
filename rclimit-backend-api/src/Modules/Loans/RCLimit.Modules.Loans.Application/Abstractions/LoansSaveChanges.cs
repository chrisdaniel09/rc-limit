using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Domain.Exceptions;

namespace RCLimit.Modules.Loans.Application.Abstractions;

public static class LoansSaveChanges
{
    // Saves the unit of work. A row changed by another request since it was read is reported as a conflict,
    // so the caller reloads and retries rather than overwriting the other change (gaps L5 and L8).
    public static async Task SaveAsync(this ILoansDbContext db, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "This loan or customer sub-limit was changed by another user. Reload the page and try again.",
                "CONCURRENT_UPDATE");
        }
    }
}

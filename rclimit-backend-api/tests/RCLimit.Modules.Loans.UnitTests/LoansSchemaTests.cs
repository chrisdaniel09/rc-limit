using Microsoft.EntityFrameworkCore;
using RCLimit.Modules.Loans.Infrastructure.Persistence;

namespace RCLimit.Modules.Loans.UnitTests;

// The Loans module owns the loans schema, and nothing else (spec section 11.3, rules 1 and 2).
public class LoansSchemaTests
{
    private static LoansDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<LoansDbContext>().UseNpgsql("Host=unused").Options);

    [Fact]
    public void Every_loans_table_is_in_the_loans_schema()
    {
        using var db = CreateContext();

        var outside = db.Model.GetEntityTypes()
            .Where(e => e.GetTableName() is not null && e.GetSchema() != LoansDbContext.Schema)
            .Select(e => $"{e.GetSchema() ?? "(default)"}.{e.GetTableName()}")
            .ToList();

        Assert.Empty(outside);
    }

    [Fact]
    public void Foreign_keys_stay_inside_the_loans_schema()
    {
        using var db = CreateContext();

        var crossing = db.Model.GetEntityTypes()
            .SelectMany(e => e.GetForeignKeys())
            .Where(fk => fk.PrincipalEntityType.GetSchema() != LoansDbContext.Schema)
            .Select(fk => $"{fk.DeclaringEntityType.GetTableName()} -> {fk.PrincipalEntityType.GetTableName()}")
            .ToList();

        Assert.Empty(crossing);
    }
}

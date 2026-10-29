using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RCLimit.Modules.Accounting.Contracts;
using RCLimit.Modules.Loans.Application.Outbox;
using RCLimit.Modules.Loans.Infrastructure.Persistence;

namespace RCLimit.Modules.Loans.Infrastructure.Outbox;

// Publishes the Loans outbox to the Accounting module. A message is marked published only after Accounting
// accepts it. A failed message keeps its place in the queue, so it is retried on the next pass.
public sealed class LoanOutboxDispatcher(IServiceScopeFactory scopes, ILogger<LoanOutboxDispatcher> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);
    private const int BatchSize = 50;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Loan outbox dispatch pass failed.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task DispatchBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<LoansDbContext>();
        var accounting = scope.ServiceProvider.GetRequiredService<IAccountingModuleApi>();

        var messages = await db.OutboxMessages
            .Where(m => m.PublishedAt == null)
            .OrderBy(m => m.OccurredAt)
            .Take(BatchSize)
            .ToListAsync(cancellationToken);

        foreach (var message in messages)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<JournalPostingPayload>(message.Payload)
                    ?? throw new InvalidOperationException("Outbox payload is empty.");

                await accounting.PostDisbursalEntryAsync(new DisbursalPostingRequest(
                    payload.TenantId,
                    payload.LoanId,
                    payload.ParticularType,
                    payload.Amount,
                    payload.Narration,
                    payload.CreatedByUserId));

                message.PublishedAt = DateTime.UtcNow;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                message.Attempts++;
                message.LastError = ex.Message;
                logger.LogWarning(ex, "Loan outbox message {MessageId} failed on attempt {Attempt}.", message.MessageId, message.Attempts);
            }

            await db.SaveChangesAsync(cancellationToken);
        }
    }
}

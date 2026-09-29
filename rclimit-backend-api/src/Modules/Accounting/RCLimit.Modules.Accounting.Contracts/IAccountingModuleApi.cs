using RCLimit.Modules.Accounting.Contracts.Dtos;

namespace RCLimit.Modules.Accounting.Contracts;

public interface IAccountingModuleApi
{
    Task<Guid> PostJournalEntryAsync(PostJournalRequest request);
    Task<decimal> GetAccountBalanceAsync(Guid accountId);
    Task<Guid?> GetAccountIdByCodeAsync(Guid tenantId, string accountCode);
    Task PostDisbursalEntryAsync(DisbursalPostingRequest request);
}

public record DisbursalPostingRequest(
    Guid TenantId,
    Guid ReferenceId,
    string ParticularType,
    decimal Amount,
    string Narration,
    Guid CreatedByUserId);

namespace RCLimit.Modules.Accounting.Contracts.Dtos;

public record JournalLineRequest(Guid AccountId, string Direction, decimal Amount);

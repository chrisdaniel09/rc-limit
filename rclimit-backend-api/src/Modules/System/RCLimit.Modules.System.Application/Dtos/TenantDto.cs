namespace RCLimit.Modules.System.Application.Dtos;

public record TenantDto(
    Guid TenantId,
    string OrganizationName,
    string Slug,
    string? CustomDomain,
    string SubscriptionPlan,
    bool IsActive,
    DateTime CreatedAt);

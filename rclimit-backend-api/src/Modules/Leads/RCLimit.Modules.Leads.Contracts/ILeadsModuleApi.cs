namespace RCLimit.Modules.Leads.Contracts;

// Lead data that other modules need. Only DTOs cross this boundary.
public interface ILeadsModuleApi
{

    Task<IReadOnlyList<CustomerLeadLinkDto>> GetLeadsForCustomerAsync(
        Guid customerId,
        CancellationToken cancellationToken = default);
}

// A lead linked to a customer, most recent link first.
public sealed record CustomerLeadLinkDto(
    Guid LeadId,
    string? ApplicantName,
    string LeadSource,
    string LeadStatus,
    DateTime CreatedAt,
    DateTime LinkedAt,
    string? VehicleRegistrationNumber);

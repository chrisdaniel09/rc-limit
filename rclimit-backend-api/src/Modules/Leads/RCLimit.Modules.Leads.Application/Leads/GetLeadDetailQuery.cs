using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Identity.Contracts;
using RCLimit.Modules.Leads.Application.Abstractions;
using RCLimit.Modules.Leads.Application.Actions;
using RCLimit.Modules.Loans.Contracts.Customers;
using RCLimit.Modules.Leads.Domain.Entities;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Application.Leads;

public record GetLeadDetailQuery(Guid LeadId) : IRequest<LeadDetailDto>;

public record LeadCheckLogDto(
    Guid LogId,
    string CheckType,
    string Status,
    int? Score,
    string? Remarks,
    string Source,
    Guid PerformedByUserId,
    string? PerformedByUserName,
    DateTime CreatedAt);

public record LeadDetailDto(
    Guid LeadId,
    string LeadSource,
    Guid? ReferredByUserId,
    string? ReferredByUserName,
    string WhatsappPhoneNumber,
    string? ContactPhone,
    string? ApplicantName,
    decimal? RequestedLoanAmount,
    string? VehicleRegistrationNumber,
    string VahanValidationStatus,
    string LeadStatus,
    string? Notes,
    Guid? AssignedToUserId,
    string? AssignedToUserName,
    string CibilCheckStatus,
    string RcCheckStatus,
    int? CibilScorePreview,
    Guid? ConvertedCustomerId,
    DateTime? ConvertedAt,
    string? ConvertedCustomerName,
    bool IsLocked,
    List<LeadCheckLogDto> CheckHistory,
    DateTime CreatedAt,
    string ProductTypeCode,
    decimal? RequestedAmount,
    string? ReferenceNumber,
    Dictionary<string, JsonElement> ProductDetails,
    List<ProductFieldDefinition> FieldSchema,
    List<ActionDefinition> ConfiguredActions,
    List<ActionExecutionDto> ActionHistory);

public class GetLeadDetailQueryHandler : IRequestHandler<GetLeadDetailQuery, LeadDetailDto>
{
    private readonly ILeadsDbContext _db;
    private readonly ITenantContext _tenant;
    private readonly IIdentityModuleApi _identity;
    private readonly ICustomersModuleApi _customers;

    public GetLeadDetailQueryHandler(
        ILeadsDbContext db,
        ITenantContext tenant,
        IIdentityModuleApi identity,
        ICustomersModuleApi customers)
    {
        _db = db;
        _tenant = tenant;
        _identity = identity;
        _customers = customers;
    }

    public async Task<LeadDetailDto> Handle(GetLeadDetailQuery request, CancellationToken cancellationToken)
    {
        var lead = await _db.Leads.FindAsync(new object[] { request.LeadId }, cancellationToken)
            ?? throw new NotFoundException("Lead", request.LeadId);

        if (lead.TenantId != _tenant.TenantId)
            throw new NotFoundException("Lead", request.LeadId);

        // Get conversion info if converted
        LeadCustomer? leadConversion = null;
        string? convertedCustomerName = null;
        DateTime? convertedAt = null;

        if (lead.ConvertedCustomerId.HasValue)
        {
            leadConversion = await _db.LeadCustomers
                .AsNoTracking()
                .FirstOrDefaultAsync(lc => lc.LeadId == request.LeadId, cancellationToken);

            if (leadConversion != null)
            {
                convertedAt = leadConversion.LinkedAt;
                var summaries = await _customers.GetSummariesAsync([leadConversion.CustomerId], cancellationToken);
                convertedCustomerName = summaries.FirstOrDefault()?.LegalName;
            }
        }

        var isLocked = lead.ConvertedCustomerId.HasValue || lead.LeadStatus == "CONVERTED";

        var checkLogs = await _db.LeadCheckLogs
            .Where(l => l.LeadId == request.LeadId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync(cancellationToken);

        var userIds = new List<Guid>();
        if (lead.ReferredByUserId.HasValue)
            userIds.Add(lead.ReferredByUserId.Value);
        if (lead.AssignedToUserId.HasValue)
            userIds.Add(lead.AssignedToUserId.Value);
        userIds.AddRange(checkLogs.Select(l => l.PerformedByUserId));

        var userNames = new Dictionary<Guid, string>();
        foreach (var uid in userIds.Distinct())
        {
            var user = await _identity.GetUserByIdAsync(uid, cancellationToken);
            if (user is not null)
                userNames[uid] = user.FullName ?? user.Email ?? uid.ToString();
        }

        var checkHistoryDtos = checkLogs.Select(l => new LeadCheckLogDto(
            l.LogId,
            l.CheckType,
            l.Status,
            l.Score,
            l.Remarks,
            l.Source,
            l.PerformedByUserId,
            userNames.TryGetValue(l.PerformedByUserId, out var userName) ? userName : null,
            l.CreatedAt)).ToList();

        string? refUserName = null;
        if (lead.ReferredByUserId.HasValue && userNames.TryGetValue(lead.ReferredByUserId.Value, out var refName))
            refUserName = refName;

        string? assignUserName = null;
        if (lead.AssignedToUserId.HasValue && userNames.TryGetValue(lead.AssignedToUserId.Value, out var assignName))
            assignUserName = assignName;

        // The schema and actions come from the product type, even if it has since been deactivated,
        // so an existing lead still shows what it was captured against.
        var productType = await _db.ProductTypes.AsNoTracking().FirstOrDefaultAsync(
            p => p.TenantId == _tenant.TenantId && p.Code == lead.ProductTypeCode, cancellationToken);

        var actionHistory = await _db.ActionExecutions
            .AsNoTracking()
            .Where(a => a.LeadId == request.LeadId)
            .OrderByDescending(a => a.StartedAt)
            .Select(a => new ActionExecutionDto(
                a.ExecutionId, a.ActionCode, a.ActionOrder, a.Status, a.ResponsePayload, a.ErrorMessage, a.StartedAt, a.CompletedAt))
            .ToListAsync(cancellationToken);

        return new LeadDetailDto(
            lead.LeadId,
            lead.LeadSource,
            lead.ReferredByUserId,
            refUserName,
            lead.WhatsappPhoneNumber,
            lead.ContactPhone,
            lead.ApplicantName,
            lead.RequestedLoanAmount,
            lead.VehicleRegistrationNumber,
            lead.VahanValidationStatus,
            lead.LeadStatus,
            lead.Notes,
            lead.AssignedToUserId,
            assignUserName,
            lead.CibilCheckStatus,
            lead.RcCheckStatus,
            lead.CibilScorePreview,
            lead.ConvertedCustomerId,
            convertedAt,
            convertedCustomerName,
            isLocked,
            checkHistoryDtos,
            lead.CreatedAt,
            lead.ProductTypeCode,
            lead.RequestedAmount,
            lead.ReferenceNumber,
            lead.ProductDetails,
            productType?.FieldSchema ?? [],
            productType?.Actions ?? [],
            actionHistory);
    }
}

using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.Abstractions;
using RCLimit.Modules.Loans.Domain.Entities;

namespace RCLimit.Modules.Loans.Application.Leads;

public sealed record CustomerMatchCandidate(
    Guid CustomerId,
    string LegalName,
    string? PhoneNumber,
    IReadOnlyList<string> Reasons);

/// <summary>
/// Suggests existing customers for a lead. Used by both the conversion preview and the convert command,
/// so the reason shown to staff is the same reason recorded on the link.
/// Reasons, strongest first: PHONE (last 10 digits of either lead phone), VEHICLE (current owner of the lead's
/// registration number), NAME (every word of the applicant name appears in the customer's legal or trade name).
/// </summary>
internal static class LeadCustomerMatcher
{
    public const string Phone = "PHONE";
    public const string Vehicle = "VEHICLE";
    public const string Name = "NAME";

    private const int MaxSuggestions = 10;
    private const int MaxNameCandidates = 50;

    private static readonly string[] ReasonOrder = [Phone, Vehicle, Name];

    public static async Task<IReadOnlyList<CustomerMatchCandidate>> FindAsync(
        ILoansDbContext db,
        Guid tenantId,
        Lead lead,
        CancellationToken cancellationToken)
    {
        var matches = new Dictionary<Guid, (string LegalName, string? PhoneNumber, HashSet<string> Reasons)>();

        void Add(Guid customerId, string legalName, string? phoneNumber, string reason)
        {
            if (!matches.TryGetValue(customerId, out var entry))
            {
                entry = (legalName, phoneNumber, new HashSet<string>());
                matches[customerId] = entry;
            }
            entry.Reasons.Add(reason);
        }

        // PHONE: stored numbers are +91XXXXXXXXXX, so the last 10 digits of a lead number identify the customer.
        foreach (var suffix in PhoneSuffixes(lead))
        {
            var pattern = "%" + suffix;
            var phoneHits = await db.Customers
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId && c.PhoneNumber != null && EF.Functions.Like(c.PhoneNumber, pattern))
                .Select(c => new { c.CustomerId, c.LegalName, c.PhoneNumber })
                .ToListAsync(cancellationToken);

            foreach (var hit in phoneHits)
                Add(hit.CustomerId, hit.LegalName, hit.PhoneNumber, Phone);
        }

        // VEHICLE: the customer who currently owns the lead's registration number.
        if (!string.IsNullOrWhiteSpace(lead.VehicleRegistrationNumber))
        {
            var normalizedReg = NormalizeRegistrationNumber(lead.VehicleRegistrationNumber);
            var ownerId = await db.Vehicles
                .AsNoTracking()
                .Where(v => v.TenantId == tenantId && v.RegistrationNumber.ToUpper() == normalizedReg)
                .Select(v => v.OwnerCustomerId)
                .FirstOrDefaultAsync(cancellationToken);

            if (ownerId.HasValue)
            {
                var owner = await db.Customers
                    .AsNoTracking()
                    .Where(c => c.CustomerId == ownerId.Value)
                    .Select(c => new { c.CustomerId, c.LegalName, c.PhoneNumber })
                    .FirstOrDefaultAsync(cancellationToken);

                if (owner is not null)
                    Add(owner.CustomerId, owner.LegalName, owner.PhoneNumber, Vehicle);
            }
        }

        // NAME: each word must appear in the legal or trade name, so word order does not matter.
        var words = (lead.ApplicantName ?? string.Empty)
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 2)
            .Select(w => w.ToLowerInvariant())
            .Distinct()
            .ToList();

        if (words.Count > 0)
        {
            var nameQuery = db.Customers
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId);

            foreach (var word in words)
            {
                var pattern = PageQuery.ContainsPattern(word);
                nameQuery = nameQuery.Where(c =>
                    EF.Functions.Like(c.LegalName.ToLower(), pattern) ||
                    EF.Functions.Like((c.TradeName ?? "").ToLower(), pattern));
            }

            var nameHits = await nameQuery
                .OrderBy(c => c.LegalName)
                .Take(MaxNameCandidates)
                .Select(c => new { c.CustomerId, c.LegalName, c.PhoneNumber })
                .ToListAsync(cancellationToken);

            foreach (var hit in nameHits)
                Add(hit.CustomerId, hit.LegalName, hit.PhoneNumber, Name);
        }

        return matches
            .Select(m => new CustomerMatchCandidate(
                m.Key,
                m.Value.LegalName,
                m.Value.PhoneNumber,
                ReasonOrder.Where(r => m.Value.Reasons.Contains(r)).ToList()))
            .OrderBy(c => Array.IndexOf(ReasonOrder, c.Reasons[0]))
            .ThenBy(c => c.LegalName)
            .Take(MaxSuggestions)
            .ToList();
    }

    public static string NormalizeRegistrationNumber(string regNo) =>
        Regex.Replace(regNo.ToUpper().Trim(), @"[\s\-]", "");

    // Digits only, last 10 digits, and never an empty or short suffix (an empty suffix would match every customer).
    private static IEnumerable<string> PhoneSuffixes(Lead lead) =>
        new[] { lead.WhatsappPhoneNumber, lead.ContactPhone }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => Regex.Replace(p!, @"\D", ""))
            .Where(d => d.Length >= 10)
            .Select(d => d[^10..])
            .Distinct();
}

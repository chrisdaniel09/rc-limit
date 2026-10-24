using System.Text.RegularExpressions;
using RCLimit.Modules.Loans.Contracts.Customers;
using RCLimit.Modules.Loans.Contracts.Vehicles;
using RCLimit.Modules.Leads.Domain.Entities;

namespace RCLimit.Modules.Leads.Application.Leads;

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
/// Customer and vehicle data is read through the module contracts, not the tables.
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
        ICustomersModuleApi customers,
        IVehiclesModuleApi vehicles,
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
        var suffixes = PhoneSuffixes(lead).ToList();
        if (suffixes.Count > 0)
        {
            foreach (var hit in await customers.FindByPhoneSuffixesAsync(suffixes, cancellationToken))
                Add(hit.CustomerId, hit.LegalName, hit.PhoneNumber, Phone);
        }

        // VEHICLE: the customer who currently owns the lead's registration number.
        if (!string.IsNullOrWhiteSpace(lead.ReferenceNumber))
        {
            var ownerId = await vehicles.FindCurrentOwnerIdAsync(lead.ReferenceNumber, cancellationToken);
            if (ownerId.HasValue)
            {
                foreach (var owner in await customers.GetSummariesAsync([ownerId.Value], cancellationToken))
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
            foreach (var hit in await customers.FindByNameWordsAsync(words, MaxNameCandidates, cancellationToken))
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

    // Digits only, last 10 digits, and never an empty or short suffix (an empty suffix would match every customer).
    private static IEnumerable<string> PhoneSuffixes(Lead lead) =>
        new[] { lead.WhatsappPhoneNumber, lead.ContactPhone }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => Regex.Replace(p!, @"\D", ""))
            .Where(d => d.Length >= 10)
            .Select(d => d[^10..])
            .Distinct();
}

# Gaps: Partners

Scope: partner create, list and lookup, commission split, and the partner links from leads and loans.

Paths are relative to `rclimit-backend-api/src/Modules/Partners/` unless shown otherwise.

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| PT1 | High | Partner create has no `HasRight`, though `partners.*` rights are seeded and unused. | `RCLimit.Modules.Partners.Infrastructure/Controllers/PartnersController.cs` lines 58–70; `rclimit-db/seed/001_seed_data.sql` lines 122–125 |
| PT2 | Medium | The partner lookup used by other modules is not tenant-filtered, so it returns partners from other tenants. | `RCLimit.Modules.Partners.Infrastructure/PartnersModuleApi.cs` lines 17–29 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| PT3 | High | The commission split is not checked to be between 0 and 100. Negative values and values above 100 are stored. The database column has no check. | `RCLimit.Modules.Partners.Application/Commands/CreatePartnerCommand.cs` lines 9–14, 39; `rclimit-db/migrations/008_public_partners.sql` line 11 |
| PT4 | Low | The partner type is checked only by the database, so a bad value gives a 500. Email has no format check. | `Application/Commands/CreatePartnerCommand.cs` lines 35, 38; `rclimit-db/migrations/008_public_partners.sql` line 7 |

## Missing features

| # | Severity | Gap | Evidence |
|---|---|---|---|
| PT5 | High | The commission split is stored and returned, but nothing computes or pays commission. There is no commission posting in code, only a posting rule in the seed. The bank, bonus and shared payout amounts on loans are not validated and are not linked to a partner. | `Domain/Entities/Partner.cs` line 12; `Infrastructure/PartnersModuleApi.cs` line 26; `RCLimit.Modules.Loans.Application/Loans/CreateLoanCommand.cs` lines 21–23; `rclimit-db/seed/001_seed_data.sql` lines 96, 107 |
| PT6 | Medium | No update, deactivate or status change exists for partners, though `partners.edit` is seeded. Partner status is never validated or enforced. | `Infrastructure/Controllers/PartnersController.cs` lines 23–70 (get, lookup, create only); `Domain/Entities/Partner.cs` line 13 |

## Links to leads and loans

| # | Severity | Gap | Evidence |
|---|---|---|---|
| PT7 | Medium | Leads and loans accept a partner id without checking that the partner belongs to the same tenant or is active. The foreign key guarantees only that the row exists. | `RCLimit.Modules.Loans.Application/Loans/CreateLoanCommand.cs` lines 14, 52; `RCLimit.Modules.Leads.Application/Leads/CreateLeadCommand.cs` lines 17, 47; `rclimit-db/migrations/009_public_loans.sql` line 12; `rclimit-db/migrations/010_public_leads.sql` line 7 |

Not verified: whether lead conversion carries the lead's partner id into the loan.

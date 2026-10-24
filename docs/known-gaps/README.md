# Known gaps by feature

Each file lists the gaps found in one feature, with severity, category and evidence. Evidence paths are relative to the repository root. Gaps were found by reading the code. Where a gap is already tracked in a spec, the spec is named.

## Severity

- **High**: a security hole, lost or inconsistent money or data, or a core flow that is broken or missing.
- **Medium**: a validation gap or missing behaviour that can be worked around, or that causes confusing errors.
- **Low**: cosmetic, latent, or defence-in-depth issues.

## Categories

- **security**: authorization, tenant isolation, credentials.
- **data-integrity**: partial writes, race conditions, unbalanced or unposted financial entries.
- **validation gap**: input accepted that should be rejected.
- **bug**: behaviour that contradicts the code's own intent or the spec.
- **missing feature**: specified or implied behaviour that does not exist.
- **consistency**: the UI and the API, or the code and the spec, disagree.

## Feature files

| File | Scope |
|---|---|
| [loans.md](loans.md) | Loans, sub-limits, RC tracker, dashboard RC aging, disbursal line items |
| [lenders-and-bank-pools.md](lenders-and-bank-pools.md) | Lenders and bank pools |
| [reference-data.md](reference-data.md) | Particular types, lender-disbursed-to options, post-disbursement document statuses |
| [accounting.md](accounting.md) | Ledger accounts, journal entries, posting rules, balance sheet, disbursal postings |
| [identity-and-access.md](identity-and-access.md) | Login, sessions, users, roles, rights, authorization |
| [tenancy-and-system.md](tenancy-and-system.md) | Tenant creation, resolution, custom domains, settings |
| [partners.md](partners.md) | Partners and their links to leads and loans |
| [leads.md](leads.md) | Leads, checks, comments, conversion |
| [customers-and-vehicles.md](customers-and-vehicles.md) | Customers, sub-limits, vehicles, ownership |
| [cross-cutting.md](cross-cutting.md) | Validation, transactions, tenant filters, authorization coverage |

## Already tracked elsewhere

- CIBIL and RC checks (automated checks not built, score and remarks handling): [../Lead_Verification_Checks_CIBIL_RC.md](../Lead_Verification_Checks_CIBIL_RC.md), section 8.
- Module boundary gaps (conversion atomicity, idempotent customer creation, batch identity lookup, customers and vehicles inside Loans): [../Architecture_Module_Boundaries.md](../Architecture_Module_Boundaries.md), section 7.
- Session and token gaps: [../user_session_architecture_specification.md](../user_session_architecture_specification.md).

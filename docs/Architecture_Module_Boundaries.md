# Module boundaries and extraction guide

This document describes how the backend is split into modules, what each module owns, which dependencies are allowed, and what is needed to run Leads as a separate service. The rules marked **enforced** are checked by `tests/RCLimit.ArchitectureTests/ModuleBoundaryTests.cs` on every test run.

---

## 1. Modules

| Module | Owns | Database schema | Notes |
|---|---|---|---|
| Identity | users, roles, rights, sessions | `auth` | Provides user lookups to other modules |
| Accounting | ledger accounts, journal entries, posting rules | `accounting` | Receives disbursal postings from Loans |
| System | tenants, tenant settings | `system` | Tenant resolution and session policy |
| Partners | partners | `public` | Referenced by id from Leads and Loans |
| Loans | customers, customer sub-limits, vehicles, customer-vehicle ownership, lenders, bank pools, loans, disbursal line items, RC tracker, entity comments (customers and loans), dashboard summary, reference data | `public` | Still one module; candidate for a later split |
| Leads | leads, lead check logs, lead-customer links, lead comments, lead dashboard | `leads` | Separated; extraction-ready |

Each module has four projects: `Domain`, `Contracts`, `Application` and `Infrastructure`. Only `Contracts` is visible to other modules.

---

## 2. Dependency rules

Enforced by `ModuleBoundaryTests`:

1. **Contracts only across modules.** A module project may reference another module only through that module's `Contracts` project. *(enforced)*
2. **Contracts stay thin.** A `Contracts` project references only `BuildingBlocks.Contracts`. *(enforced)*
3. **Domain and Contracts have no persistence.** No EF Core or Npgsql packages in `Domain` or `Contracts` projects. *(enforced)*
4. **Application never references Infrastructure.** *(enforced)*
5. **Module Infrastructure is referenced only by the WebApi host.** *(enforced)*
6. **Source-level check.** Code in one module may name another module's namespace only as `RCLimit.Modules.<Other>.Contracts.*`. This catches `using` statements and fully qualified names that a project reference alone would not show. *(enforced)*

Leads' dependencies on other modules, as of this document:
- `Identity.Contracts`: user names for display.
- `Loans.Contracts`: customer and vehicle operations during conversion.

Loans' dependency on Leads: `Leads.Contracts` only, for the customer-leads page.

---

## 3. Contracts

### Leads (`ILeadsModuleApi`)
- `GetLeadsForCustomerAsync(customerId)`: leads linked to a customer, most recent link first.

### Loans (`ICustomersModuleApi`)
- `ExistsAsync`, `GetSummariesAsync`
- `FindByPhoneSuffixesAsync`, `FindByNameWordsAsync`: candidate search for lead conversion.
- `CreateFromLeadAsync`: creates the customer and its sub-limit from a lead.

### Loans (`IVehiclesModuleApi`)
- `FindCurrentOwnerIdAsync`, `GetOwnershipPreviewAsync`
- `EnsureAssignableAsync`: checks every ownership rule and writes nothing.
- `AssignToCustomerAsync`: records the ownership change. Checks the rules first.
- `GetOpenVehicleCountsAsync`

### Identity (`IIdentityModuleApi`)
- `GetUserByIdAsync`, `ValidateUserExistsAsync`

Contracts exchange DTOs only. No EF types or entities cross a module boundary.

---

## 4. Data ownership

- A table belongs to one module, and lives in that module's schema.
- **No foreign keys cross schemas.** Migration `028` removed the ones that pointed from lead tables, and from `customer_vehicles` into leads. Cross-module references are plain ids, checked by application code through contracts.
- Tenancy is a plain `tenant_id` column on each table. It is enforced in queries, not by the database.

Lead tables: `leads.leads`, `leads.lead_check_logs`, `leads.lead_customers`, `leads.lead_comments`.

Foreign keys still inside the lead schema: `lead_check_logs.lead_id`, `lead_customers.lead_id`, `lead_comments.lead_id`, all to `leads.leads`.

Comments are split. Customers and loans use `public.entity_comments` (type `CUSTOMER` or `LOAN`). Leads use `leads.lead_comments`.

---

## 5. Conversion: the one cross-module workflow

`ConvertLeadToCustomerCommand` (in Leads) does this:

1. Loads and validates the lead. It must not already be converted.
2. For an existing customer: `ExistsAsync`. For a new one, the customer type and sub-limit are required.
3. If the lead has a vehicle: `EnsureAssignableAsync`, which checks ownership and open loans before anything is written.
4. Creates the customer (`CreateFromLeadAsync`) or uses the existing one.
5. If the lead has a vehicle: `AssignToCustomerAsync`.
6. Writes the link row and marks the lead as converted.

Step 3 runs before any write, so a rejected vehicle transfer creates no customer.

**Known limits**
- Steps 4 to 6 are not one database transaction. A failure after step 4 leaves the customer created and the lead unconverted.
- `CreateFromLeadAsync` is not idempotent. A retry after such a failure creates a second customer. Making it idempotent needs a source-lead column on customers. That column has not been added.

---

## 6. Runtime notes

- All modules run in one process today. Contracts are bound to in-process implementations in each module's `Infrastructure` project, registered in each `*ModuleRegistration`.
- MediatR scans each module's `Application` assembly. Requests are routed by type, so a module's handlers are not visible to others unless they go through a contract.
- Controllers are discovered per module through `AddApplicationPart` in `Program.cs`.
- Routes did not change during the split. Leads endpoints remain under `/api/v1/leads`, the lead dashboard under `/api/v1/dashboard/me`, and the customer-leads page under `/api/v1/customers/{id}/leads`.

---

## 7. Known gaps

1. **Name lookups are one call per user.** Leads and comments call `GetUserByIdAsync` in a loop. This is fine in-process and would be slow over a network. Add a batch method to `IIdentityModuleApi` before extraction.
2. **Conversion is not atomic.** See section 5.
3. **`CreateFromLeadAsync` is not idempotent.** See section 5.
4. **Customers and vehicles are still inside Loans.** The customer and vehicle contracts are implemented in the Loans module. Customers and Vehicles need their own modules before Leads can be extracted without bringing Loans along.
5. **Customer-leads page reads Loans ownership data.** `GetCustomerLeadsQuery` lives in Loans and reads `customer_vehicles` for the vehicle action. The lead list comes from `ILeadsModuleApi`.
6. **Dev database grant is skipped.** Migration `028` grants the `app_user` role access to the `leads` schema only if that role exists. It does not exist in the current dev database, so the grant has not been applied there.
7. **Integration events are unused.** `LoanDisbursedEvent` and `UserRegisteredEvent` are defined but never published or handled. The spec's MassTransit design is not built.

---

## 8. Extraction checklist (Leads as a service)

1. **Database.** Give Leads its own database. The `leads` schema can move as-is, because it has no foreign keys to other schemas.
2. **Customers and vehicles.** Replace the `ICustomersModuleApi` and `IVehiclesModuleApi` implementations with HTTP clients that call the Loans service. Keep the interfaces and DTOs unchanged. Idempotency for `CreateFromLeadAsync` must exist first (gap 3).
3. **Identity.** Replace `IIdentityModuleApi` with an HTTP client, and add a batch lookup (gap 1).
4. **Reverse calls.** Loans calls `ILeadsModuleApi.GetLeadsForCustomerAsync`. Expose it over HTTP, or move the customer-leads page to call the Leads service directly.
5. **Authentication.** JWT validation is stateless and needs no change. Forward the tenant and user context on every call from Leads to other services.
6. **Gateway.** Route `/api/v1/leads/*` and `/api/v1/dashboard/me` to the Leads service. Route everything else to the existing host.
7. **Comments.** Lead comments are already separate (`leads.lead_comments`), so nothing moves.
8. **Tests.** Run the architecture rules, then the behaviour comparisons from the split: lead detail, conversion preview, customer leads and dashboard must match their pre-split responses.

---

## 9. Verification

- `dotnet test tests/RCLimit.ArchitectureTests`: the six rules in section 2.
- `dotnet build`: 0 errors, 0 warnings.
- Behaviour: compare responses for lead detail, conversion preview, customer leads, dashboard and lead comments before and after any change to a module boundary.

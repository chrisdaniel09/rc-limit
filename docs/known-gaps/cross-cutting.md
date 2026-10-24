# Gaps: Cross-cutting

Gaps that affect several features. Feature files refer here for these items.

## CC1. No input validation layer (Medium, validation gap)

There is no validator library, no data-annotation checks and no validation pipeline. Each handler checks its own input, and many commands bind raw request bodies. The per-feature files list the specific holes.

## CC2. No transaction boundaries (High, data integrity)

The backend has no `TransactionScope`, no `BeginTransaction` and no execution strategy. Where a feature writes in several steps, a failure part-way leaves partial data. The main cases:
- Loan creation and disbursal postings (see [loans.md](loans.md) L6, L7).
- Lead conversion (already in [../Architecture_Module_Boundaries.md](../Architecture_Module_Boundaries.md) section 7).
- Journal posting, whose entry and lines are saved separately (see [accounting.md](accounting.md) AC6).

## CC3. No tenant query filters (High, security)

No DbContext uses `HasQueryFilter`. Tenant isolation depends entirely on each handler adding its own filter. Several handlers do not (see [loans.md](loans.md) L2, L3; [accounting.md](accounting.md) AC3; [identity-and-access.md](identity-and-access.md) ID4, ID5; [tenancy-and-system.md](tenancy-and-system.md) TS1; [partners.md](partners.md) PT2; [reference-data.md](reference-data.md) RD1).

## CC4. Authorization coverage (High, security)

`HasRight` is applied only in the dashboard, users, roles, rights and the leads module's own endpoints, and even there not every endpoint. Right names are seeded for most features but not enforced. These write endpoints check only that the user is signed in:

| Area | Endpoints | Evidence | Seeded right not enforced |
|---|---|---|---|
| Loans | create loan, add line item, document-status update | `RCLimit.Modules.Loans.Infrastructure/Controllers/LoansController.cs` lines 69, 85, 109 | none specific |
| Lenders | create lender | `Controllers/LendersController.cs` line 36 | none specific |
| Lender-disbursed-to options | create | `Controllers/LenderDisbursedToOptionsController.cs` line 29 | none specific |
| Particular types | create, update | `Controllers/ParticularTypesController.cs` lines 30, 46 | none specific |
| Document statuses | create, update | `Controllers/PostDisbursementDocumentStatusController.cs` lines 29, 45 | none specific |
| Vehicles | create, update, customer vehicle add | `Controllers/VehiclesController.cs` lines 37, 52; `Controllers/CustomersController.cs` line 124 | no `vehicles.*` right seeded |
| Customers | create, and all reads | `Controllers/CustomersController.cs` lines 24–25, 49–50, 60–61, 78–79, 93–94, 109–110 | `customers.view`, `customers.create`, `customers.edit`, `customers.delete` |
| Leads | list, detail, comments read, create | `RCLimit.Modules.Leads.Infrastructure/Controllers/LeadsController.cs` lines 24–25, 48–49, 63–64, 165–166 | `leads.view`, `leads.create`, `leads.delete` |
| Partners | create | `RCLimit.Modules.Partners.Infrastructure/Controllers/PartnersController.cs` lines 58–70 | `partners.*` |
| Tenants | create, list, get | `RCLimit.Modules.System.Infrastructure/Controllers/TenantsController.cs` lines 17–65 | none |
| Accounting | every write (accounts, journals, posting rules) | `RCLimit.Modules.Accounting.Infrastructure/Controllers/AccountingController.cs` lines 16, 24, 61, 152, 173 | `accounting.*` |

The seeded rights are listed in `rclimit-db/seed/001_seed_data.sql` lines 114–134, and the intended model is described in `docs/User_Roles_And_Rights.md`.

## CC5. Unmapped errors become 500 (Medium, bug)

The global exception handler maps only domain exceptions to specific status codes. Anything else becomes a generic 500. That includes:
- Business-rule failures thrown as plain invalid-operation exceptions (`RCLimit.BuildingBlocks.Infrastructure/Middleware/GlobalExceptionHandler.cs` lines 20–24). Examples: sub-limit exceeded and stop-supply in `Modules/Loans/RCLimit.Modules.Loans.Application/Loans/CreateLoanCommand.cs` lines 37, 40; the lead-line-item gate in `…DisbursalLineItems/AddDisbursalLineItemCommand.cs` line 38; the document-status lookup in `…DocumentStatuses/UpdateDocumentStatusCommand.cs` line 25.
- Database unique-index and check-constraint violations, which surface as `DbUpdateException`. Duplicate codes and bad enumerated values therefore return 500 instead of 409 or 400. Examples are listed in [lenders-and-bank-pools.md](lenders-and-bank-pools.md) LP4, [reference-data.md](reference-data.md) RD3 and RD4, and [accounting.md](accounting.md) AC11.

## CC6. Partial failure and retries (High, data integrity)

Because of CC2, a client that retries after a 500 can create duplicate data. Loan creation and line-item posting are the clearest cases (see [loans.md](loans.md) L6, L7).

## CC7. Stub integrations (Medium, missing feature)

The WhatsApp and Vahan services are no-op stubs bound in `RCLimit.WebApi/Program.cs` (lines 63–65). Nothing sends messages, and no real vehicle check runs. The aging alerts that would use WhatsApp are described in [loans.md](loans.md) L27. The automated checks are described in [../Lead_Verification_Checks_CIBIL_RC.md](../Lead_Verification_Checks_CIBIL_RC.md) section 8.

## CC8. Integration events unused (Low, missing feature)

`LoanDisbursedEvent` and `UserRegisteredEvent` are defined in `RCLimit.BuildingBlocks.Contracts/IntegrationEvents`, but nothing publishes or handles them. The message-based design in the specification is not built. See [../Architecture_Module_Boundaries.md](../Architecture_Module_Boundaries.md) section 7.

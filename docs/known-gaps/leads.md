# Gaps: Leads

Scope: lead capture, assignment, lifecycle status, checks, comments, conversion preview and convert, lead list and detail, the "my leads" dashboard, financial requirements (product types), their fields, and the actions that run on a lead.

Paths are relative to `rclimit-backend-api/src/Modules/Leads/`. Already-tracked items (automated checks, score and remarks handling, conversion atomicity, idempotent customer creation, batch identity lookup) are in [../Lead_Verification_Checks_CIBIL_RC.md](../Lead_Verification_Checks_CIBIL_RC.md) section 8 and [../Architecture_Module_Boundaries.md](../Architecture_Module_Boundaries.md) section 7, and are not repeated here.

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| LD1 | High | List, detail and comment GET endpoints have no `HasRight`. Any signed-in user can read every lead in the tenant, with names, phones and check history. `leads.view` is seeded but not enforced. | `RCLimit.Modules.Leads.Infrastructure/Controllers/LeadsController.cs` lines 24–25, 63–64, 165–166; `rclimit-db/seed/001_seed_data.sql` line 126; `rclimit-ui/src/App.tsx` line 55 |
| LD2 | High | A user with `leads.edit` can assign a lead to a user in another tenant. The name lookup is not tenant-filtered, so that user's name and email are then readable. | `RCLimit.Modules.Identity.Infrastructure/IdentityModuleApi.cs` lines 19–20; `Application/Leads/GetLeadDetailQuery.cs` line 113 |
| LD3 | Medium | `POST /api/v1/leads` has no `HasRight("leads.create")`, though the right is seeded. | `Infrastructure/Controllers/LeadsController.cs` lines 48–49; `rclimit-db/seed/001_seed_data.sql` line 127 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| LD4 | Medium | Assignee and referred-by user ids are never checked for existence. `ValidateUserExistsAsync` exists, but nothing calls it, and the Identity implementation is dead. | `Application/Leads/AssignLeadCommand.cs` line 32; `Application/Leads/CreateLeadCommand.cs` line 41; `RCLimit.Modules.Identity.Infrastructure/IdentityModuleApi.cs` line 27 |
| LD5 | Medium | Partner and referred-by ids are not checked for tenancy. A bad partner id hits a foreign key and returns a generic 500. | `Application/Leads/CreateLeadCommand.cs` lines 17, 41; `rclimit-db/migrations/010_public_leads.sql` line 7; `RCLimit.BuildingBlocks.Infrastructure/Middleware/GlobalExceptionHandler.cs` line 23 |
| LD6 | Medium | Lead status is free text. The command blocks only `CONVERTED`. The table has no check constraint, and the defined status list is never used to validate input. | `Application/Leads/UpdateLeadStatusCommand.cs` line 36; `Infrastructure/Persistence/Configurations/LeadConfiguration.cs` line 25; `Domain/ValueObjects/LeadConstants.cs` lines 3–10 |
| LD7 | Medium | Lead source, requested loan amount (negative values are accepted) and registration number are not validated. The registration number is stored unnormalised. | `Application/Leads/CreateLeadCommand.cs` lines 40, 45–46 |
| LD8 | Medium | Conversion of a `REJECTED` lead is allowed. Convert checks only that the lead is not already converted. Assign and check commands do check status. | `Application/Leads/ConvertLeadToCustomerCommand.cs` lines 48–49 |
| LD9 | Medium | Convert checks the customer type only when it is non-empty. Any other value breaks the database check and returns a generic 500. The assigned ceiling is not checked to be positive. | `Application/Leads/ConvertLeadToCustomerCommand.cs` lines 78–79, 85; `rclimit-db/migrations/006_public_customers.sql` line 7 |
| LD10 | Low | Converting a lead with no applicant name creates a customer called "Unknown". | `Application/Leads/ConvertLeadToCustomerCommand.cs` line 88 |

## Business rules and consistency

| # | Severity | Gap | Evidence |
|---|---|---|---|
| LD11 | Medium | Conversion preview reports `SAME_OWNER` for an unowned vehicle when no customer is selected, because `null == null` matches. The convert path is guarded, so this affects the preview only. | `RCLimit.Modules.Loans.Infrastructure/ModuleApis/VehiclesModuleApi.cs` lines 31–32 |
| LD12 | Low | Comments can be added to converted leads, while assign, status, checks and convert are blocked. | `Application/Comments/AddLeadCommentCommand.cs` lines 33–45 |
| LD13 | Low | The dashboard's "open leads" figure is total minus converted, so rejected leads are counted as open. | `Application/Dashboard/GetMyDashboardQuery.cs` lines 48–52; `rclimit-ui/src/pages/dashboard/widgets/MyLeadsWidget.tsx` line 46 |
| LD14 | Low | `partnerId` is accepted on create, but the UI never sends it and no response returns it. | `Application/Leads/CreateLeadCommand.cs` line 17; `rclimit-ui/src/pages/leads/LeadsPage.tsx` lines 100–109; `Application/Leads/GetLeadDetailQuery.cs` lines 25–48 |

## Performance

| # | Severity | Gap | Evidence |
|---|---|---|---|
| LD15 | Low | Lead search uses `LIKE` on `lower()` with a leading wildcard, so no index can help. The `leadStatus` filter is not validated. | `Application/Leads/GetLeadsQuery.cs` lines 46–50; `Infrastructure/Controllers/LeadsController.cs` line 27 |
| LD16 | Low | Lead detail returns the full, unpaged check history. | `Application/Leads/GetLeadDetailQuery.cs` lines 98–101 |

## Financial requirements and actions

These cover the product-neutral model added in migrations 029 and 030: product types with a field schema and an ordered action list, lead details captured against that schema, and `action_executions`.

| # | Severity | Category | Gap | Evidence |
|---|---|---|---|---|
| LD17 | High (fixed) | consistency | Conversion reads the customer's CIBIL score from the legacy `cibil_score_preview` column. Only the legacy check endpoint writes that column. A score recorded by the `CIBIL_CHECK` action never reaches `customers.cibil_score`, so the customer's tier is wrong. | `Application/Leads/ConvertLeadToCustomerCommand.cs` line 90; `Application/Actions/RunLeadActionsCommand.cs` (writes `action_executions` only) |
| LD18 | Medium (fixed) | missing feature | Conversion decides whether to assign a vehicle from the legacy `vehicle_registration_number` column, not from a field with the `vehicle_registration` role. Other role-tagged vehicle fields (chassis, engine, make, model, variant, year) are not copied to `public.vehicles`. | `Application/Leads/ConvertLeadToCustomerCommand.cs` lines 47, 68, 82, 96 |
| LD19 | Medium | consistency | The legacy check endpoint still writes `lead_check_logs` and the legacy lead columns. The UI no longer calls it, but nothing stops it, so the two records can diverge. | `Application/Leads/RecordLeadCheckCommand.cs` lines 53–64; `Infrastructure/Controllers/LeadsController.cs` lines 115–117 |
| LD20 | Medium | consistency | The check forms are hard-coded in the UI. `ACTION_TAKES_SCORE` decides whether a score box is shown, so a new action or a change to an existing one needs edits on both sides. The UI can also show a score field that the backend rejects. | `rclimit-ui/src/pages/leads/productTypes.ts` lines 48–58; `rclimit-ui/src/pages/leads/LeadDetailPage.tsx` (Verifications card) |
| LD21 | Medium | data-integrity | A failed run stops the sequence. Actions after it are neither run nor recorded as skipped, so the history cannot show that they were not attempted. The UI reports only the first failure. | `Application/Actions/RunLeadActionsCommand.cs` line 101; `rclimit-ui/src/pages/leads/LeadDetailPage.tsx` (`handleRunActions`) |
| LD22 | Low | bug | Only `BusinessRuleException` is recorded as a failed run. Any other exception, for example an action code missing from the registry, aborts the request and leaves that run unrecorded. | `Application/Actions/RunLeadActionsCommand.cs` lines 72, 81 |
| LD23 | Low (fixed) | missing feature | Action history had no timestamps. Fixed: the action DTO now carries `startedAt` and `completedAt`. `ActionExecutionDto` has no `startedAt` or `completedAt`, so the detail page cannot date or order runs beyond the server's default order. | `Application/Actions/RunLeadActionsCommand.cs` lines 16–22; `Application/Leads/GetLeadDetailQuery.cs` line 152 |
| LD24 | Medium | data-integrity | Updating a product type replaces its field schema and actions without checking existing leads. A removed or retyped field keeps its stored value, but the UI and create validation then ignore or reject it, and nothing warns the admin. | `Application/ProductTypes/ProductTypeCommands.cs` lines 92–93 |
| LD25 | Medium | validation gap | A missing product type code silently becomes `USED_CV` in code, so an old client or a typo creates a Used CV lead. | `Application/Leads/CreateLeadCommand.cs` line 45 |
| LD26 | Medium | consistency | Used CV's registration field is `required` in the seeded schema. The legacy create path used to accept a lead without a registration; it now returns 422. | `rclimit-db/migrations/029_lead_product_types.sql` line 36; `Application/Leads/CreateLeadCommand.cs` line 52 |
| LD27 | Low | bug | `vahanValidationStatus` is still returned on every lead, but nothing writes it and the default is always `PENDING`. It is a leftover from the old model. | `Domain/Entities/Lead.cs` line 17; `Application/Leads/GetLeadsQuery.cs` line 83 |
| LD28 | Low | consistency | The default product types are inserted by migration 029 and again by seed 004. Changing one without the other leaves fresh and upgraded databases different. | `rclimit-db/migrations/029_lead_product_types.sql` line 30; `rclimit-db/seed/004_lead_product_types.sql` line 5 |

## Testing

| # | Severity | Category | Gap | Evidence |
|---|---|---|---|---|
| LD29 | Medium | missing feature | There are no tests for the action executor, the create-with-product-type handler, the lead detail query or the HTTP endpoints. The database round-trip test is the only persistence test, and it returns early unless `RCLIMIT_TEST_DB` is set, so a normal run passes without exercising it. | `tests/RCLimit.Modules.Leads.UnitTests/LeadsPersistenceRoundTripTests.cs` lines 14–21 |
| LD30 | Low | missing feature | The lead list, detail and product type admin screens have no automated tests. They were checked by type-check, lint and a production build only. | `rclimit-ui/` (no test runner in `package.json`) |

## Setup

| # | Severity | Category | Gap | Evidence |
|---|---|---|---|---|
| LD31 | Medium | missing feature | Tenant creation does not seed lead product types (see TS8 in [tenancy-and-system.md](tenancy-and-system.md)). A new tenant has no financial requirements, so its leads cannot be created until someone runs seed `004` by hand. | `rclimit-db/seed/004_lead_product_types.sql`; `rclimit-backend-api/src/Modules/System/RCLimit.Modules.System.Application/Commands/CreateTenantCommand.cs` lines 24–27 |

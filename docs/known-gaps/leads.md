# Gaps: Leads

Scope: lead capture, assignment, lifecycle status, checks, comments, conversion preview and convert, lead list and detail, and the "my leads" dashboard.

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

# Gaps: Loans

Scope: loan creation, the loan list and detail, sub-limit enforcement, document status updates, the RC tracker, the RC aging alerts and dashboard figures, and disbursal line items.

Paths are relative to `rclimit-backend-api/src/Modules/Loans/` unless shown otherwise.

> **Update 2026-10-29:** fixed by the loan lifecycle and ledger work (`docs/Loans_Module_Enhancements.md` section 7): L1–L10, L12–L17, L19, L23, L25, L29 (dead RC-proof link removed), L31–L33. L11 is fixed for vehicle and pool, not partner. The line numbers below refer to the code before that change.

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| L1 | High | Most loan write endpoints check only that the user is signed in, not any right. Loan create, line-item add and document-status update have no `HasRight`. | `RCLimit.Modules.Loans.Infrastructure/Controllers/LoansController.cs` lines 69, 85, 109 |
| L2 | High | The sub-limit is loaded by customer id with no tenant filter. A customer id from another tenant is accepted and its sub-limit is charged. | `RCLimit.Modules.Loans.Application/Loans/CreateLoanCommand.cs` lines 33–34 |
| L3 | High | The loan is loaded by id only when a line item is added. Another tenant's loan can be changed, and the posting is made under the caller's tenant. | `RCLimit.Modules.Loans.Application/DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 31–32 |
| L4 | Medium | The lender-disbursed-to lookup in line items and loan detail matches on code only, with no tenant filter. | `AddDisbursalLineItemCommand.cs` lines 34–35; `Loans/GetLoanDetailQuery.cs` lines 35–36; `Loans/UpdateLoanDocumentStatusCommand.cs` lines 42–43 |

## Data integrity

| # | Severity | Gap | Evidence |
|---|---|---|---|
| L5 | High | The sub-limit ceiling check and the utilization update are separate steps with no concurrency token. Two concurrent creates can both pass the check. | `Loans/CreateLoanCommand.cs` lines 33–40, 74–79; `rclimit-db/migrations/006_public_customers.sql` lines 28–29 |
| L6 | High | Loan creation saves the loan, then posts the journal in a separate save. A posting failure leaves a loan with no journal, and a client retry creates a duplicate loan. | `Loans/CreateLoanCommand.cs` lines 81, 83–89 |
| L7 | High | A line item is saved, then posted to accounting in a separate save. A posting failure leaves the item saved and returns 500, and a retry double-counts the debit. | `DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 61, 63–69 |
| L8 | Medium | The running balance is read from the last item without a lock. Two concurrent line items can compute the same balance. | `DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 26–29 |
| L9 | Medium | `loan_number` is not unique and uses a random 4-digit suffix, so collisions are possible. | `Loans/CreateLoanCommand.cs` line 47; `rclimit-db/migrations/009_public_loans.sql` line 7 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| L10 | Medium | Loan create does not check that the customer exists. A missing sub-limit silently skips the ceiling and pending-RC checks. | `Loans/CreateLoanCommand.cs` lines 33–34 |
| L11 | Medium | Loan create does not check that the vehicle, bank pool or partner exists or belongs to the tenant. | `Loans/CreateLoanCommand.cs` lines 50–52 |
| L12 | Medium | Loan create does not check that the vehicle belongs to the customer. Ownership is checked only on transfer. | `Loans/CreateLoanCommand.cs`; `Infrastructure/ModuleApis/VehiclesModuleApi.cs` lines 66–69 |
| L13 | Medium | The lender-disbursed-to value is stored as text with no check against the options table. | `Loans/CreateLoanCommand.cs` line 56; `rclimit-db/migrations/016_add_lender_disbursed_fields.sql` line 9 |
| L14 | Medium | No amount checks. The lender-disbursed amount is not compared to the sanctioned amount, and no amount is checked to be positive. | `Loans/CreateLoanCommand.cs` lines 31–63 |
| L15 | Medium | Line items have no bound on the debit. Zero, negative or over-balance debits are accepted, so the running balance can go negative. | `DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 40–41 |
| L16 | Medium | The particular type on a line item is free text. It is not checked against the types table, and inactive types are accepted. | `DisbursalLineItems/AddDisbursalLineItemCommand.cs` line 47; `Infrastructure/Controllers/LoansController.cs` lines 127–133 |
| L17 | Low | A missing loan on line-item add returns 500, not 404. | `DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 31–32 |
| L18 | Low | The customer name is dereferenced without a null guard in loan detail and document-status update. Not confirmed reachable. | `Loans/GetLoanDetailQuery.cs`; `Loans/UpdateLoanDocumentStatusCommand.cs` |

## Missing features and bugs

| # | Severity | Gap | Evidence |
|---|---|---|---|
| L19 | High | Sub-limit utilization and pending-RC count are only ever incremented. Nothing reverses them on clearance, although the specification requires it. | `Loans/CreateLoanCommand.cs` lines 76–77; `docs/RC_Limit_System_Specification.md` (clearance section) |
| L20 | High | Stop-supply is never set. Nothing writes `StopSupplyFlag` as true, so the automatic stop after the lender's tenure limit does not happen. The tenure limit is stored but never read. | `Domain/Entities/CustomerSubLimit.cs` line 11; `Domain/Entities/Lender.cs` line 10; `docs/RC_Limit_System_Specification.md` |
| L21 | High | Bank pool capacity is never checked or updated. The utilized amount is written nowhere. | `Domain/Entities/MasterBankPool.cs` line 10 |
| L22 | High | The RC tracker is created with default values and never updated. Stage, aging status and document fields never change. | `Domain/Entities/RcPipelineTracker.cs` lines 7–8; only write is creation in `Loans/CreateLoanCommand.cs` lines 65–72 |
| L23 | High | Loan status never leaves `DISBURSED_RC_PENDING`. Active counts and aging alerts therefore never shrink. | `Domain/Entities/LoanTransaction.cs` line 24; no transition code |
| L24 | High | Dashboard `pendingRcCount` counts every tracker that is not `BANK_VERIFIED_CLEARED`, which means every loan ever created. It does not match the sub-limit's pending-RC count. | `Application/Dashboard/GetDashboardSummaryQuery.cs` lines 42–44 |
| L25 | High | RC aging alerts never resolve, because the query filters on a status that never changes. | `Application/Dashboard/GetRcAgingAlertsQuery.cs` lines 34–35 |
| L26 | Medium | Aging alert buckets match the spec (0–30, 31–44, 45+), but the list filter is `> 15`, so day 15 is excluded. Thresholds are hard-coded rather than taken from the lender's tenure. | `Application/Dashboard/GetRcAgingAlertsQuery.cs` lines 54–56, 60 |
| L27 | Medium | Aging alerts are never sent. The WhatsApp service is a no-op stub, and nothing calls it. | `rclimit-backend-api/src/WebApi/RCLimit.WebApi/Program.cs` line 65 |
| L28 | Medium | Loan detail and list show a stale RC aging status. The tracker's aging status is always `ON_TIME`, while the day count is computed live. | `Application/Loans/GetLoanDetailQuery.cs`; `Application/Loans/UpdateLoanDocumentStatusCommand.cs` line 76 |
| L29 | Medium | The "upload RC proof" link points to a route that does not exist. The UI button has no handler. | `Infrastructure/Controllers/LoansController.cs` lines 63–64; `rclimit-ui/src/pages/loans/LoanDetailPage.tsx` lines 172–176 |
| L30 | Medium | A document-status update only sets the foreign key. It does not change the loan status, the tracker or the aging. | `Application/Loans/UpdateLoanDocumentStatusCommand.cs` line 36 |
| L31 | Medium | Document-status update does not check the referenced status (existence, tenant, active). Bad or inactive ids produce a 500 or are stored. | `Application/Loans/UpdateLoanDocumentStatusCommand.cs` line 36 |

## Consistency between UI and API

| # | Severity | Gap | Evidence |
|---|---|---|---|
| L32 | High | **Verified.** The document-status update is a `PATCH` on the backend, but the UI sends `POST`, so the action fails. | Backend `Infrastructure/Controllers/LoansController.cs` line 109 (`[HttpPatch]`); UI `rclimit-ui/src/pages/loans/LoanDetailPage.tsx` line 132 (`apiPost`); `rclimit-ui/src/api/client.ts` lines 151–152 |
| L33 | Medium | **Verified.** The UI shows a balance from net disbursed, which is zero until the first line item. The backend's running balance starts from the lender-disbursed amount. The two disagree before the first line item. | UI `LoanDetailPage.tsx` lines 69–73, 190; backend `Application/Loans/CreateLoanCommand.cs` line 57; `Application/DisbursalLineItems/AddDisbursalLineItemCommand.cs` line 40 |

## Notes

- Dashboard authorization is correct: the dashboard endpoints use `HasRight` (`Infrastructure/Controllers/DashboardController.cs` lines 23 and 40).
- Line-item gating and the balance base follow `docs/Loans_Module_Enhancements.md`: the balance starts from the lender-disbursed amount, and line items are enabled per lender-disbursed-to option.

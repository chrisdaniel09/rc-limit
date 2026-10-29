# Loans Module: Enhancements, Current-State Review and Design Plan

**Date:** 2026-10-29
**Scope:** `RCLimit.Modules.Loans` and `RCLimit.Modules.Accounting`, reviewed against `docs/loan_lifecycle_file_revamp_specification.md` (Version 4.0).
**Status:** Phases 1–3 implemented on 2026-10-29 (see section 7). Phases 4–6 not started.
**Related:** `docs/known-gaps/loans.md` (gap IDs L1–L33 below refer to it).

---

## 1. Original Enhancement Requests: Status

| # | Request | Status | Evidence | Remaining gap |
|---|---|---|---|---|
| 1 | Add **Lender Disbursed Amount** and **Lender Disbursed To** (dropdown, configurable values: Customer, AnnaFinance) | **Done** | Migration `016_add_lender_disbursed_fields.sql`; `lender_disbursed_to_options` table with seed rows `CUSTOMER` and `ANNA_FINANCE` (`rclimit-db/seed/001_seed_data.sql`); options endpoint; create form and loan detail in `rclimit-ui/src/pages/loans/` | Amount is not checked against sanctioned amount or for positivity (L14). Value is stored as text, not checked against the options table (L13). |
| 2 | Disbursal line items enabled only when Lender Disbursed To is AnnaFinance | **Done**, driven by a flag, not a hard-coded code | `allows_disbursal_line_items` on the option; `AddDisbursalLineItemCommand` rejects items when the option does not allow them; loan detail returns `isDisbursalLineItemsEnabled`; UI shows the Add button only when it is true | Backend error for a disallowed option is not a clean business-rule response (to confirm in the error mapping). |
| 3 | Line-item balance based on Lender Disbursed Amount, not Sanction Amount | **Partly done** | Backend: `previousBalance = lastItem?.RunningBalanceAmt ?? loan.LenderDisbursedAmount` (`AddDisbursalLineItemCommand.cs`). UI: `calculateBalance` falls back to `netDisbursedAmount`, which is 0 until the first line item (`LoanDetailPage.tsx`). | The UI shows a balance of 0 before the first line item while the backend baseline is the lender-disbursed amount (L33). Fix the UI fallback. |

---

> **Update 2026-10-29:** items 1 and 3 are superseded by section 5 (credit and debit entries). The Lender Disbursed fields are to be retired, and the balance will come from the ledger entries rather than the loan.

## 2. Current Implementation Review

### 2.1 What exists

- **Loan record:** `loan_transactions` (public schema at the time of this review; now `loans`) with customer, vehicle, pool, partner, sanctioned amount, lender disbursed amount and to, net disbursed amount, customer rate, payout fields, `loan_status`, disbursal date, remarks and document-status link.
- **Creation is disbursal:** `CreateLoanCommand` saves the loan already in `DISBURSED_RC_PENDING`, increments sub-limit utilization and pending-RC count, creates an RC tracker and posts a `BANK_DISBURSAL` journal entry for the sanctioned amount in the same request.
- **Line items:** `disbursal_line_items` holds debit amounts with a running balance. There is no credit row and no direction column.
- **Particular types:** configurable table `disbursal_particular_types` (seeded with RTO_CHARGES, VALUATION_FEES, PAYMENT_TO_BROKER_SELLER and others).
- **Post-disbursement documents:** a configurable catalog `post_disbursement_document_statuses` (seeded with RC_RECEIVED and INSURANCE_RECEIVED) and one foreign key on the loan. There is no per-document checklist.
- **Comments:** generic `entity_comments` table, shared with Leads.
- **Dashboard:** RC aging alerts and pending-RC counts, both with known defects (L24–L28).

### 2.2 Gaps against the specification

Each row compares the specification (Version 4.0) with the current code.

| Area | Specification | Current implementation | Gap |
|---|---|---|---|
| **Lifecycle** | State machine: `NEW → DOCUMENTS_PENDING → LOGGED_IN → CREDIT_REVIEW → SANCTIONED → DISBURSED → CLOSED`, with `REJECTED` and `WITHDRAWN` as terminal branches | Single `loan_status` with one value, `DISBURSED_RC_PENDING`. No transitions (L23). | **Missing.** No stage actions, no guards, no terminal states. |
| **Creation vs disbursal** | A file is created first (`NEW`) and disbursed later (`DISBURSED`) through `PATCH /loans/{id}/disburse` | Creation and disbursal are one step (`POST /loans`). Journal posted at creation. | **Structural difference.** Disbursal endpoint does not exist. |
| **Milestone dates** | `logged_in_date`, `sanction_date`, `disbursal_date`, `closed_date`, `rejection_withdrawn_date` and reason, `emi_start_date`, `emi_due_day` | Only `disbursal_date` | **Missing** except disbursal date. |
| **Financial fields** | `requested_amount` (required), `sanctioned_amount`, `net_disbursed_amount`, `customer_rate`, `tenure_months`, `emi_amount`, payout fields | All present except `requested_amount` (removed from leads in this cycle, not on loans), `tenure_months` and `emi_amount` | **Missing:** `tenure_months`, `emi_amount`, and a decision on `requested_amount` for loans. |
| **Application number** | `application_number VARCHAR(50) UNIQUE NOT NULL` | `loan_number` `LN-{year}-{random 4 digits}`, not unique (L9) | **Defect and gap.** Collisions are possible. |
| **Beneficiary** | Fixed enum `CUSTOMER_DIRECT` / `ANNA_FINANCE_CLEARING`, default `ANNA_FINANCE_CLEARING` | Configurable options `CUSTOMER` / `ANNA_FINANCE`, default `CUSTOMER`, with a line-item flag | **Naming and default differ.** Decision D1. |
| **Initial credit row** | Auto-created `INITIAL_BANK_DISBURSAL_RELEASE` `CREDIT` row when beneficiary is Anna Finance, running balance set to gross | No credit row. Baseline is implicit in the running balance. | **Missing.** Also explains the UI balance gap (item 3 above). |
| **Line-item shape** | `entry_direction` (`CREDIT`/`DEBIT`), `amount > 0`, `mode_of_payment`, `bank_name`, `account_no`, `transaction_id`, `entry_date`, `created_by` | `debit_amount` only, no direction, no creator, no amount check (L15) | **Missing** direction and creator. |
| **Net disbursed meaning** | `net_disbursed_amount` = remaining running balance, cleared to 0 at net settlement | Set to `LenderDisbursedAmount - runningBalance`, which is the **total deducted**, not the remaining balance | **Semantic mismatch.** Decision D6. |
| **Sub-limit timing** | Utilized at `DISBURSED`, restored at `CLOSED`; headroom checked at `SANCTIONED` | Utilized and pending-RC incremented at creation. Never reversed (L19). Stop-supply never set (L20). | **Mismatch and gaps.** |
| **Bank pool** | Not specified in detail | Capacity never checked or updated (L21) | Gap against the lender pool model. |
| **PDD** | Table `loan_pdd_documents`: five document types, per-document status machine (`PENDING` → `SUBMITTED_TO_BROKER` → `VERIFIED_BY_OPS` → `SUBMITTED_TO_BANK` → `ACCEPTED_BY_BANK`, `REJECTED_OVERDUE`), due date, proof URL, verification, bank acknowledgement | Catalog of post-disbursement statuses and one FK. No checklist, no per-document status, no due date. | **Missing.** Largest functional gap. |
| **PDD SLA** | 30–45 days (text); sample code uses 45 | RC aging buckets 0–30, 31–44, 45+ (L26) | **Conflict.** Decision D4. |
| **RC Limit Ledger** | `GET /api/v1/accounting/rc-limit-ledger` with filters; dedicated UI menu; drill-down to voucher and journal | None | **Missing.** |
| **Servicing / EMI** | `emi_start_date`, `emi_due_day`, `emi_amount`; monthly call queue 5 days before due day; `loan_emi_reminders` log with `call_result`, promised date, remarks | None | **Missing.** |
| **Comments** | `loan_comments` table with `comment_type` and `metadata` | Generic `entity_comments` (shared with Leads) | **Different model.** Decision D5. |
| **Loan API** | `POST /loans` takes `{customerId, productType, requestedAmount, partnerId}`; `PATCH /disburse`; comments and EMI reminder endpoints | `POST /loans` takes the full financial payload; no disburse, EMI or PDD endpoints | **Different contract.** |
| **Products** | `USED_CV`, `NEW_CV`, `REFINANCE` enum | `product_type` free string, default `USED_CV`, no validation | **Missing** validation and the two other products. |

### 2.3 Known defects that block the design

These come from `docs/known-gaps/loans.md` and affect the lifecycle work. They should be fixed first (see Phase 1).

- **Security:** write endpoints have no `HasRight` (L1); sub-limit, loan and lender-option lookups are not tenant-scoped (L2–L4).
- **Integrity:** no concurrency token on sub-limit (L5); create and posting are two saves, so a failure leaves a loan with no journal and a retry duplicates it (L6); line item and posting are two saves, so a retry double-counts (L7); running balance read without a lock (L8).
- **Validation:** no check that customer, vehicle, pool or partner exist or belong to the tenant (L10–L12); no amount checks (L14–L15); particular type is free text (L16).
- **UI and API:** document-status update is `PATCH` in the API but `POST` in the UI (L32); balance fallback wrong (L33).

---

## 3. Decisions Needed Before Detailed Design

Each decision needs a recommendation from the design phase and sign-off before Phase 2.

| ID | Question | Options | Recommendation |
|---|---|---|---|
| **D1** | Beneficiary model | (a) Keep the configurable options table with a line-item flag. (b) Replace with the spec's fixed enum. | **(a).** It meets the "configurable values" requirement. Add a `beneficiary_kind` column (`CUSTOMER_DIRECT` / `ANNA_FINANCE_CLEARING`) on the option so the initial-credit rule has a stable meaning. Decide the default. |
| **D2** | Lifecycle adoption | (a) Adopt the spec's state machine and split creation from disbursal. (b) Keep creation-as-disbursal and add stages later. | **Resolved 2026-10-29: (a).** Creation makes a `NEW` file. Sanction (`SANCTIONED`, with the sanctioned amount) is checked against sub-limit headroom. Disbursal (`DISBURSED`) utilizes the sub-limit and posts the journal, as the spec requires. Existing loans map to `DISBURSED`. |
| **D3** | Application number | (a) Per-tenant sequence, unique. (b) Keep `LN-…` format, add unique constraint. | **Resolved 2026-10-29: (a).** Each tenant gets a unique sequence for `application_number`, which replaces the random `LN-…` number and fixes L9. Retiring `loan_number` is the default, to be confirmed in detailed design. |
| **D4** | PDD SLA | (a) 45 days from disbursal, as in the spec's code. (b) 30 days. (c) Configurable per lender. | **Resolved 2026-10-29: (c).** The PDD SLA is configurable per lender, with a default of 45 days. The lender's limit is data, not code. |
| **D5** | Comments | (a) Reuse `entity_comments` and add `comment_type` if needed. (b) New `loan_comments` table as the spec defines. | **Resolved 2026-10-29: (a).** Loans reuse the shared `entity_comments` table, which Leads already use, and add `comment_type` if needed. |
| **D6** | Net disbursed meaning | (a) `net_disbursed_amount` = remaining balance (spec). (b) Keep total deducted and rename. | **(a).** Rename the UI label "Net Disbursed" to match. Settle this before the ledger report, since the report depends on it. |
| **D7** | Requested amount on loans | (a) Add `requested_amount` as the spec says. (b) Omit for now. | **Resolved 2026-10-29: (a).** Loans get `requested_amount`, as the spec says. Leads have no such field, since it was removed from leads in this cycle. |
| **D8** | Initial credit row | (a) Materialize row 1 as the spec says. (b) Keep the implicit baseline. | **Resolved 2026-10-29: dropped.** User-entered credits replace it (section 5). |
| **D9** | Spec inconsistencies | The spec's diagram shows `PDD_PENDING` and `IN_PROGRESS` after `DISBURSED`, but neither is in the enum. `pdd_overall_status` values are not defined in the text. The sub-limit headroom check is at `SANCTIONED` in the table but at creation in the current code. | **Deferred to detailed design (2026-10-29).** No decision yet. Record the resolution in the spec when made. |

---

## 4. Design Phase Plan

### 4.1 Deliverables

1. **Resolved decisions D1–D9** recorded in this document, with the spec updated where it conflicts.
2. **Lifecycle transition table:** for each transition, the actor's right, the required fields, the side effects (journal, sub-limit, PDD generation, tracker) and the error returned when the guard fails.
3. **Data model:** column-level design for `loan_transactions`, `disbursal_line_items`, `loan_pdd_documents`, `loan_emi_reminders` and the sub-limit changes, with migration numbers starting at **033** (032 is the lead-requested-amount drop).
4. **Data migration plan:** map each existing `loan_status` to the new state, backfill sub-limit utilization for existing loans, and generate the initial credit row for existing Anna Finance loans where the balance is known.
5. **API contract:** the routes in section 2.2 (create, disburse, line items, document status, PDD checklist, comments, EMI reminders, RC Limit Ledger), with request and response shapes and `HasRight` for each.
6. **UI plan:** loan list filtered by stage; loan detail with stage actions and a disburse dialog that takes beneficiary, sanctioned amount, lender disbursed amount and EMI fields; PDD checklist panel; EMI call queue; RC Limit Ledger page with drill-down.
7. **Accounting plan:** which journal entry posts at which transition, and how reversals work on rejection, withdrawal and closure.
8. **Test plan:** unit tests for the transition guards and balance arithmetic; integration tests for disbursal with and without the Anna Finance flag; migration rehearsal on a copy of the seed data.

### 4.2 Phases

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Decisions** | Settle D1–D9 with the user. Update the spec where it conflicts. | Decision table signed off. |
| **1. Stabilize** | Fix the blocking defects: L1–L4 (rights and tenant scope), L5–L8 (concurrency and atomicity), L32 (PATCH/POST), L33 (balance fallback). Fix Enhancement 3's UI gap. | Known-gap rows marked fixed. Balance shows the lender-disbursed amount before the first line item. |
| **2. Lifecycle core** | Data model (baseline migration 008). State machine with guards. Split create (`NEW`) from disburse (`DISBURSED`). Sub-limit utilized at disbursal, restored at closure. Journal postings move to the transitions. | Transition tests pass. Existing loans migrated. Sub-limit reconciles against the sum of open loans. |
| **3. Disbursal and ledger** | Credit and debit entries with counterparty, amount checks and the no-negative-balance rule (section 5). Anna Finance balance (D6). Lender Disbursed fields retired (C2). RC Limit Ledger endpoint and page with drill-down. | Ledger balances reconcile with journal entries for sample loans. Line items cannot take a balance negative. |
| **4. PDD** | `loan_pdd_documents` with the five types and the status machine. Due date from D4. Overdue job that sets `REJECTED_OVERDUE` and the stop-supply flag (L20). | Checklist generated at disbursal. Overdue documents set stop-supply. |
| **5. Servicing** | EMI fields (`emi_amount`, `tenure_months`). Monthly call queue 5 days before `emi_due_day`. Call log with `call_result`. Comments reuse (D5). | Queue lists the expected calls for a month. Call results are recorded and visible on the loan. |
| **6. Products** | Validate `NEW_CV` and `REFINANCE` rules: new-vehicle proforma and dealer payment, refinance foreclosure payout. | Each product has its own required fields and tests. |

Phases 2–5 depend on Phase 1. Phase 6 can start once Phase 2 is stable.

### 4.3 Risks

- **Journal timing moves.** Moving the `BANK_DISBURSAL` posting from creation to disbursal changes monthly figures. Reconcile before cutover.
- **Sub-limit timing changes.** Existing loans have utilization counted from creation. The backfill must not double-count.
- **Existing data.** Loans in `DISBURSED_RC_PENDING` map to `DISBURSED`, but RC pending status has no equivalent in the new model. Decide how RC pending is carried (RC tracker or PDD document).
- **Spec drift.** The spec's sample C# is illustrative. Port it to the module's existing patterns (`ILoansDbContext`, MediatR handlers, `ITenantContext`, `IAccountingModuleApi`) rather than copying it.

### 4.4 Out of scope for this design

- Credit-bureau integration and automated RC verification.
- Automated WhatsApp reminders (the service is a stub, L27).
- Changes to the accounting chart of accounts beyond the new posting rules.

---

## 5. Ledger Entries: Credits and Debits

Revised 2026-10-29 after design discussion. This section replaces the earlier Disbursed To design. It supersedes items 1 and 3 in section 1 and the initial-credit approach in D8. Not yet coded.

### 5.1 Model

Every ledger entry is either a **CREDIT** or a **DEBIT**. The user chooses the entry type.

- **Credit:** the bank pays out. The **recipient** is `ANNA_FINANCE` or `CUSTOMER`. Any number of credits is allowed, and each one has its own amount.
- **Debit:** a payout from the Anna Finance balance. The **payee** is the customer, seller, RTO, insurer, and so on, and the entry carries a particular type.
- **Anna Finance balance** = sum of credits with recipient `ANNA_FINANCE` − sum of all debits.
- A credit with recipient `CUSTOMER` is recorded in the ledger but does not change the Anna Finance balance.

Each entry stores one counterparty: the recipient for a credit, the payee for a debit. Both come from the configurable options table.

### 5.2 Requirements

- **R1. Stage guard.** Entries can be added only while the loan is `DISBURSED` (under D2; `DISBURSED_RC_PENDING` is the stand-in until then).
- **R2. Credits.** Amount must be greater than zero. Recipient is `ANNA_FINANCE` or `CUSTOMER`. No limit on the number of credits.
- **R3. Debits.** Amount must be greater than zero. A debit may not take the Anna Finance balance below zero (Q4 confirmed).
- **R4. Ledger toggle.** The RC Limit Ledger has a view-only toggle that hides customer-bound rows. The toggle is not stored and is off by default. Hidden rows still count toward the balance (see C1 for which rows are hidden).
- **R5. Lender Disbursed Amount is derived.** It equals the sum of credits with recipient `ANNA_FINANCE`. It is not entered separately. Show a warning, not an error, if the total differs from the sanctioned amount.

### 5.3 Impact on the design

- **Data:** `disbursal_line_items` gains `entry_direction` (`CREDIT` / `DEBIT`, chosen by the user) and `counterparty` (from the options table). The current `debit_amount`-only shape changes to a single `amount` with a direction.
- **Loan record:** `lender_disbursed_amount` and `lender_disbursed_to` stop being inputs. Retire them once the ledger is in place (C2).
- **Sanctioned amount:** moves out of the create form. It is set by the transition to `SANCTIONED` (section 5.4), and the sub-limit headroom check moves to that transition too.
- **Disburse action:** changes the status to `DISBURSED` and records no credit. Credits are added afterwards as ledger entries (C3).
- **Spec:** the automatic initial release row (spec section 4.B) is dropped, so the spec needs updating.
- **Balance and D6:** `net_disbursed_amount` becomes the Anna Finance balance (credits to Anna Finance minus debits). This matches the spec's meaning, so D6 is resolved in the spec's favour.
- **Line-item gate:** the loan's `allows_disbursal_line_items` flag no longer gates entries. The entry's own counterparty decides what is allowed.
- **Phase:** Phase 3 (disbursal and ledger). The data change joins the Phase 2 migrations.

### 5.4 Confirmations (resolved 2026-10-29)

- **C1. Scope of the toggle: resolved.** The toggle hides only the bank's direct credits to the customer (credits with recipient `CUSTOMER`). Anna Finance's debits to the customer stay visible.
- **C2. Loan-level Lender Disbursed fields: resolved.** The create form stops asking for Lender Disbursed Amount and Lender Disbursed To. The `allows_disbursal_line_items` flag is dropped.
- **C3. First credit: resolved.** The first credit is a normal entry recorded after disbursal. The disburse action changes the status and records no credit.
- **Sanctioned Amount timing (new, from the user).** Sanctioned Amount is captured at loan level only when the status moves to `SANCTIONED`. It is not entered at creation. This follows the spec's state matrix, where sub-limit headroom is checked at `SANCTIONED`.

### 5.5 Interaction with the other decisions

- **D1 (beneficiary model):** resolved by this section. The options table now serves the counterparty of each entry, and the loan-level dropdown is retired (C2).
- **D6 (net disbursed meaning):** resolved. `net_disbursed_amount` is the Anna Finance balance.
- **D8 (initial credit row):** resolved. The automatic row is dropped and the first credit is a user-entered entry (C3).

---

## 6. Next Step

D1–D8 are resolved. D9 is deferred to detailed design. Section 5 is settled. Phases 1–3 are implemented (section 7). Phase 4 (PDD) waits on D9.

---

## 7. Implementation Status (2026-10-29)

### 7.1 Done

| Phase | What was built |
|---|---|
| **1. Stabilize** | `HasRight` on every loan endpoint (L1). Loans, customers, vehicles, pools, counterparties and particular types are looked up within the tenant (L2–L4, L13, L16). Row versions (PostgreSQL `xmin`) on loans, sub-limits and the application-number sequence turn concurrent writes into a 409 (L5, L8). Journal postings go through a transactional outbox, published by a background dispatcher (L6, L7). Amount checks (L14, L15). Missing loan returns 404 (L17). Document status is validated (L31) and the UI uses `PATCH` (L32). The balance comes from the ledger (L33). |
| **2. Lifecycle core** | State machine in `Domain/Rules/LoanStatuses.cs`. Create makes a `NEW` file with a requested amount (D7) and an application number from a per-tenant sequence (D3). Sanction captures the amount, tenure and rate and checks sub-limit headroom. Disburse re-checks headroom, utilizes the sub-limit, starts the RC tracker for Used CV and sets the PDD due date from the lender's `pdd_sla_days` (D4). Close restores the sub-limit (L19). Reject and withdraw need a reason. The create form only offers the selected customer's vehicles, and the server rejects any other vehicle (L12). |
| **3. Ledger** | Entries are CREDIT or DEBIT with a counterparty (section 5). Only allowed in `DISBURSED`. A debit cannot take the Anna Finance balance below zero. `net_disbursed_amount` is the Anna Finance balance (D6). Lender Disbursed Amount is shown as the sum of Anna Finance credits, with a warning when it differs from the sanction. RC Limit Ledger page and `GET /api/v1/loans/rc-limit-ledger` with the "Hide direct customer credits" toggle (C1). |

Schema: baseline migration `rclimit-db/migrations/008_loans_lifecycle.sql` (the database scripts were rebuilt as a fresh baseline on 2026-10-29; see `rclimit-db/README.md`). Verified end to end against a fresh database: create, stage moves, sanction, disburse, credits and debits, close, outbox publishing and journal posting.

### 7.2 Choices made during implementation

- **Journal postings happen per ledger entry, not at disbursal.** Each credit posts under the `BANK_DISBURSAL` rule and each debit under its particular type's rule. Disbursal posts nothing, because no money has moved until the first credit. This differs from the spec's "journal entries posted" at `DISBURSED`, and needs confirming with the accounting owner.
- **Column names kept:** the status column stays `loan_status` (the spec says `file_status`) and the ledger table stays `disbursal_line_items`. `loan_number` is replaced by `application_number`.
- **Generic status route:** stages without data move through `POST /api/v1/loans/{id}/status`. Sanction and disburse have their own routes.
- **Open loans for vehicle transfer:** any loan not `REJECTED`, `WITHDRAWN` or `CLOSED` now blocks a vehicle transfer. Before, only `DISBURSED_RC_PENDING` did.
- **Existing data:** existing loans become `DISBURSED`. Each existing Anna Finance loan gets a CREDIT entry for its old lender-disbursed amount, so its balance carries over.

### 7.3 Not done

- Phases 4–6 (PDD checklist, servicing and EMI calls, product-specific rules).
- Partner existence is not checked on create (L11, partner part).
- Spec 4.1 sections 11–13 other than the schema: the outbox is built, but the reverse call to Leads and the HTTP contracts for extraction are not. (The `loans` schema itself is done: all Loans tables are in `loans`.)
- Dashboard pending-RC count (L24) and the other RC tracker gaps (L22, L26–L28, L30).
- Lender PDD SLA can be set on create through the API, but not edited, and not from the UI.

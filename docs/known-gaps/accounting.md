# Gaps: Accounting

Scope: ledger accounts, journal entries, posting rules, the balance sheet, and the disbursal postings that Loans sends to accounting.

Paths are relative to `rclimit-backend-api/src/Modules/Accounting/` unless shown otherwise.

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| AC1 | High | Accounting write endpoints have `[Authorize]` only and no `HasRight`. Any signed-in user can create accounts, post journals, and create or change posting rules, even though `accounting.*` rights are seeded. | `Infrastructure/Controllers/AccountingController.cs` lines 16, 24, 61, 152, 173; `rclimit-db/seed/001_seed_data.sql` lines 130–133 |
| AC2 | High | Posting does not check that the accounts belong to the tenant or are active. The ledger line has no tenant column, `IsActive` is never read on posting, and no endpoint deactivates an account. | `Application/Commands/PostJournalEntryCommand.cs` lines 42–52; `Domain/Entities/LedgerLineItem.cs` lines 1–15; `Domain/Entities/LedgerAccount.cs` line 11; `Infrastructure/Controllers/AccountingController.cs` lines 24–59 |
| AC3 | High | Posting-rule update loads the rule by id only, with no tenant filter, so a rule in another tenant can be changed. The new account ids are not validated. | `Application/Commands/UpdatePostingRuleCommand.cs` lines 21, 23–24 |

## Data integrity

| # | Severity | Gap | Evidence |
|---|---|---|---|
| AC4 | High | Journal posting is not in the same transaction as the business write that triggers it. Loan creation and line items save first, then post. A posting failure leaves a loan or line item without a journal, and a retry duplicates the loan. (Detailed in [loans.md](loans.md) L6 and L7.) | `Application/Loans/CreateLoanCommand.cs` lines 81, 83–89; `Application/DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 61, 63–69 |
| AC5 | High | When no posting rule matches, the disbursal posts nothing and still returns success. No error or log is raised. | `Infrastructure/AccountingModuleApi.cs` lines 49–56 |
| AC6 | High | The journal is posted in a separate save from anything else, with no transaction covering the entry and its lines. | `Application/Commands/PostJournalEntryCommand.cs` lines 54–55 |
| AC7 | Medium | Posting rules are saved before the accounts are checked. A missing account makes the lookup return null, and the null-forgiving dereference throws after the rule is already stored, so a 500 leaves a rule behind. | `Application/Commands/CreatePostingRuleCommand.cs` lines 31–41 |
| AC8 | Low | The loan-disbursal posting uses the sanctioned amount, while line items post the debit amount. Whether this is correct needs business confirmation. | `Application/Loans/CreateLoanCommand.cs` lines 83–89; `Application/DisbursalLineItems/AddDisbursalLineItemCommand.cs` lines 63–69 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| AC9 | Medium | The journal balance check sums only debit and credit lines. Lines with other direction values are stored but ignored in the sum. An empty line list passes, because zero equals zero. | `Application/Commands/PostJournalEntryCommand.cs` lines 24–29, 42–52 |
| AC10 | Low | Zero and negative amounts are not rejected in the application. The database check fires and returns a 500, not a 400. | `Application/Commands/PostJournalEntryCommand.cs` lines 42–52; `rclimit-db/migrations/004_accounting_ledger.sql` lines 45–46 |
| AC11 | Medium | Ledger account type is free text in the application, and only the database check constrains it, so a bad value gives a 500. A duplicate account code also gives a 500, not a 409. | `Application/Commands/CreateLedgerAccountCommand.cs` lines 18–27; `rclimit-db/migrations/004_accounting_ledger.sql` lines 8, 15 |

## Missing features and bugs

| # | Severity | Gap | Evidence |
|---|---|---|---|
| AC12 | Medium | Ledger accounts cannot be edited or deleted through the API, and the database foreign key blocks delete. There is also no way to retire or deactivate an account. | `Application/Commands/CreateLedgerAccountCommand.cs`; `rclimit-db/migrations/004_accounting_ledger.sql` |
| AC13 | Medium | The balance sheet's "check" figure is assets minus liabilities minus equity. It leaves out income and expenses, so it does not test the accounting equation. | `Application/Queries/GetBalanceSheetQuery.cs` line 56 |

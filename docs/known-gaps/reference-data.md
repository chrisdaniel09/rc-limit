# Gaps: Reference data

Scope: disbursal particular types, lender-disbursed-to options, and post-disbursement document statuses. These are per-tenant lookup lists used by loans and line items.

Paths are relative to `rclimit-backend-api/src/Modules/Loans/` unless shown otherwise.

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| RD1 | High | Updating a particular type is not scoped to the tenant. It is loaded by id only, so a user can edit another tenant's type. A missing id returns a 500. | `Application/DisbursalLineItems/UpdateParticularTypeCommand.cs` lines 18–19 |
| RD2 | Medium | Creating a document status has no `HasRight`. | `Infrastructure/Controllers/PostDisbursementDocumentStatusController.cs` lines 29, 45; `Application/DocumentStatuses/CreateDocumentStatusCommand.cs` lines 34–35 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| RD3 | Low | Creating a particular type has no duplicate check. The unique index catches duplicates, and that error is a 500. | `Application/DisbursalLineItems/CreateParticularTypeCommand.cs` lines 18–27; `rclimit-db/migrations/015_disbursal_particular_types.sql` line 9 |
| RD4 | Low | Creating a document status has no duplicate check. The unique index catches duplicates, and that error is a 500. | `rclimit-db/migrations/021_post_disbursement_document_status.sql` line 10 |
| RD5 | Medium | A loan's document-status update does not check that the referenced status exists, belongs to the tenant or is active. Bad or inactive ids give a 500 or are stored. (Also in [loans.md](loans.md) L31.) | `Application/Loans/UpdateLoanDocumentStatusCommand.cs` line 36 |

## Missing features and consistency

| # | Severity | Gap | Evidence |
|---|---|---|---|
| RD6 | High | Lender-disbursed-to options have no update or deactivate endpoint. The create command omits the line-item flag, so it defaults to false, and enabling it needs a database change. | `Infrastructure/Controllers/LenderDisbursedToOptionsController.cs` lines 14–29, 45; `Application/LenderDisbursedToOptions/CreateLenderDisbursedToOptionCommand.cs` lines 16–25 |
| RD7 | Medium | There is no administration screen for lender-disbursed-to options or document statuses. Both are read-only on the loan screens. | `rclimit-ui/src/pages/loans/LoansPage.tsx` line 50; `rclimit-ui/src/pages/loans/LoanDetailPage.tsx` line 95 |
| RD8 | Medium | A document-status update only sets the foreign key. Changing the status does not change the loan status, the tracker or the aging. (Also in [loans.md](loans.md) L30.) | `Application/Loans/UpdateLoanDocumentStatusCommand.cs` line 36 |
| RD9 | Low | The loan-disbursed event is defined, but nothing publishes or handles it. | `RCLimit.BuildingBlocks.Contracts/IntegrationEvents/LoanDisbursedEvent.cs` line 5 |

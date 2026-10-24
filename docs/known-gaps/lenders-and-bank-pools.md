# Gaps: Lenders and bank pools

Scope: lender create and list, bank pool list, and the links from loans to pools.

Paths are relative to `rclimit-backend-api/src/Modules/Loans/` unless shown otherwise.

| # | Severity | Gap | Evidence |
|---|---|---|---|
| LP1 | High | Bank pools cannot be created. The bank pool controller exposes only GET, and no write handler exists. Pools exist only from the seed data. | `RCLimit.Modules.Loans.Infrastructure/Controllers/BankPoolsController.cs` lines 21–34 |
| LP2 | High | Bank pool capacity is never checked or updated. The utilized amount is written nowhere, so a pool's limit does not constrain loans. (Also in [loans.md](loans.md) L21.) | `Domain/Entities/MasterBankPool.cs` line 10 |
| LP3 | Low | The bank pool list ignores the `lenderId` query that the lender's links use. | `Infrastructure/Controllers/LendersController.cs` line 46; `Infrastructure/Controllers/BankPoolsController.cs` line 22 |
| LP4 | Low | Lender create has no duplicate check. Only the unique index in the database catches duplicates, and that error is a 500. | `Application/Lenders/CreateLenderCommand.cs` lines 38–39; `rclimit-db/migrations/005_public_lenders_pools.sql` line 17 |
| LP5 | Low | There is no bank pool screen. The loans page reads pools but cannot manage them. | `rclimit-ui/src/pages/loans/LoansPage.tsx` line 46 |
| LP6 | Medium | Lender create has no `HasRight`. (Covered in [cross-cutting.md](cross-cutting.md) CC4.) | `Infrastructure/Controllers/LendersController.cs` line 36 |

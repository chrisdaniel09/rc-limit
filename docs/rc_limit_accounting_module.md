# RCLimit Management System: Accounting Module Technical Specification

**Document Type:** Technical Domain Specification  
**Module Name:** `RCLimit.Modules.Accounting`  
**Database Schema:** `accounting` (Neon PostgreSQL)  
**System Name:** **RCLimit** (RCLimit Engine)  
**Operational Unit:** Anna Finance (DSA of Commercial Vehicles)  
**Status:** Architecture Baseline (Modular Monolith & Double-Entry Accounting Engine)  
**Date:** September 2026  

---

## 1. Domain Overview & Purpose

The **Accounting Module** (`RCLimit.Modules.Accounting`) serves as the core double-entry financial ledger for the **RCLimit** platform. While operational loan modules (such as `Loans`) capture single-entry voucher line items (e.g., `disbursal_line_items` for RTO, Insurance, and Valuation fees), the Accounting Module tracks the **entire financial health, balances, assets, liabilities, and equity** of the DSA enterprise.

### Dual-Ledger Accounting Scope
An RC Limit Broker operates on a **Dual-Ledger system**:
1. **Bank-to-Broker Ledger:** Tracks aggregate credit line liabilities owed to institutional lenders (e.g., *Chola*, *HDFC*, *ICICI*) @ wholesale bank interest rates.
2. **Broker-to-Customer Ledger:** Tracks working capital assets owed by used car dealers / commercial vehicle buyers @ retail customer rates.

> **Core Accounting Principle:** Every financial transaction within the platform must be posted as a balanced **Journal Entry** where total Debits equal total Credits ($\sum \text{Debits} = \sum \text{Credits}$). Journal entries are **append-only and strictly immutable** to ensure auditor-grade compliance and security.

---

## 2. Database Schema DDL (`accounting` Schema)

The module operates inside its own isolated database schema (`accounting`) inside Neon PostgreSQL to enforce module boundaries and security isolation.

```sql
CREATE SCHEMA IF NOT EXISTS accounting;

-- 1. Chart of Accounts (Audited & Mutable)
-- Defines master accounts across Asset, Liability, Equity, Income, and Expense categories.
CREATE TABLE accounting.ledger_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT TRUE,
    
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by_user_id UUID,
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_tenant_account_code UNIQUE (tenant_id, account_code)
);

CREATE INDEX idx_ledger_accounts_code ON accounting.ledger_accounts(account_code);
CREATE INDEX idx_ledger_accounts_tenant ON accounting.ledger_accounts(tenant_id);

-- 2. Journal Entry Headers (Audited & Immutable)
-- Master transaction header linking back to originating business event (Loan, Disbursal, Payout).
CREATE TABLE accounting.journal_entries (
    journal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entry_number SERIAL,
    entry_date DATE DEFAULT CURRENT_DATE,
    reference_id UUID NOT NULL, -- Links to loan_id, disbursal_line_item_id, or payout_id
    transaction_type VARCHAR(50) NOT NULL, -- 'BANK_DISBURSAL', 'CUSTOMER_DISBURSAL', 'FEE_DEDUCTION', 'COMMISSION_PAYOUT'
    narration TEXT NOT NULL,
    
    created_by_user_id UUID NOT NULL,
    posted_by_role VARCHAR(50) NOT NULL,
    source_module VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journal_entries_reference ON accounting.journal_entries(reference_id);
CREATE INDEX idx_journal_entries_tenant ON accounting.journal_entries(tenant_id);
CREATE INDEX idx_journal_entries_date ON accounting.journal_entries(entry_date);

-- 3. Ledger Line Items (Audited & Immutable)
-- Balanced Debit/Credit lines tied to individual accounts.
CREATE TABLE accounting.ledger_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id UUID NOT NULL REFERENCES accounting.journal_entries(journal_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounting.ledger_accounts(account_id),
    entry_direction VARCHAR(10) NOT NULL CHECK (entry_direction IN ('DEBIT', 'CREDIT')),
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_lines_journal ON accounting.ledger_line_items(journal_id);
CREATE INDEX idx_ledger_lines_account ON accounting.ledger_line_items(account_id);

```

## 3. Master Chart of Accounts (COA) Structure
The module establishes a standard Chart of Accounts structure tailored for RC Limit Brokers:

| Account Code | Account Name | Account Type | Ledger Domain | Business Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1010-CASH** | Master Bank Settlement Account | ASSET | Internal Broker | Physical cash/bank account receiving bank funds & releasing payouts. |
| **1100-DLR-AST** | Dealer Loan Receivable | ASSET | Broker-to-Customer | Outstanding loan principal owed by used car dealers / customers. |
| **2100-BNK-LIAB** | Lender Bank Pool Debt (e.g., Chola) | LIABILITY | Bank-to-Broker | Wholesale credit facility drawn from partner banks/NBFCs. |
| **4010-FEE-INC** | Convenience & Handling Fee Income | INCOME | Internal Broker | Revenue earned from line deductions (processing/handling fees). |
| **4020-COMM-INC** | Bank Base Commission Payout | INCOME | Internal Broker | Gross commission earned from partner banks (PAYOUT + BONUS_PAYOUT). |
| **5010-SUB-EXP** | Shared Sub-Broker Commission | EXPENSE | Internal Broker | Outflow commission shared downstream with agents (SHARED_PAYOUT). |
| **5020-RTO-EXP** | RTO Pass-Through Account | LIABILITY/EXPENSE | Broker-to-Customer | RTO transfer and hypothecation fees collected for remittance. |
| **5030-INS-EXP** | Insurance Pass-Through Account | LIABILITY/EXPENSE | Broker-to-Customer | Vehicle insurance premium withheld for insurer payment. |


## 4. Key Accounting Posting Scenarios
Scenario A: Execution of Loan Disbursal (Gross Sanction: ₹15,00,000 | Net Payout: ₹14,75,000 | Fees: ₹25,000)
When a loan disbursal is finalized, the system posts a balanced multi-line journal entry[cite: 7]:
```Plaintext
Journal Entry: DISB-2026-0089 (Ref: loan_id)
Narration: Disbursal execution for Vehicle GJ05BX6637 under Dealer Jiva Wasim

DEBIT   1100-DLR-AST (Dealer Loan Receivable)       ₹15,00,000.00
CREDIT  2100-BNK-LIAB (Chola Bank Pool Liability)     ₹15,00,000.00
------------------------------------------------------------------
DEBIT   1010-CASH (Master Bank Settlement)          ₹15,00,000.00  (Bank Release)
CREDIT  1010-CASH (Master Bank Settlement)          ₹14,75,000.00  (Net Payout Outflow)
CREDIT  4010-FEE-INC (Convenience Fee Income)           ₹10,000.00  (Deduction)
CREDIT  5020-RTO-EXP (RTO Fee Payable)                   ₹10,000.00  (Deduction)
CREDIT  5030-INS-EXP (Insurance Fee Payable)              ₹5,000.00  (Deduction)
```

## 5. C# Code Structure (RCLimit.Modules.Accounting)
Following Clean Architecture and Modular Monolith principles, the accounting module codebase is organized into four layers[cite: 7]:

``` Plaintext

src/Modules/Accounting/
├── RCLimit.Modules.Accounting.Domain/
│   ├── Entities/
│   │   ├── LedgerAccount.cs          (Aggregate Root: Code, Type, Status)
│   │   ├── JournalEntry.cs           (Aggregate Root: ReferenceId, Narration, Audit metadata)
│   │   └── LedgerLineItem.cs         (Entity: Direction, Amount, AccountId)
│   ├── ValueObjects/
│   │   └── Money.cs                  (Amount, Currency)
│   └── Exceptions/
│       └── UnbalancedJournalEntryException.cs
│
├── RCLimit.Modules.Accounting.Application/
│   ├── Commands/
│   │   ├── PostJournalEntry/
│   │   │   ├── PostJournalEntryCommand.cs
│   │   │   └── PostJournalEntryCommandHandler.cs
│   │   └── ReverseJournalEntry/
│   │       └── ReverseJournalEntryCommand.cs
│   ├── Queries/
│   │   ├── GetAccountBalance/
│   │   └── GetTrialBalance/
│   └── IntegrationEvents/
│       └── JournalEntryPostedIntegrationEvent.cs
│
├── RCLimit.Modules.Accounting.Infrastructure/
│   ├── Persistence/
│   │   ├── AccountingDbContext.cs    (EF Core DbContext mapped to 'accounting' schema)
│   │   ├── Configurations/           (Entity type configurations)
│   │   └── Repositories/
│   └── Services/
│       └── JournalPostingService.cs  (Validates Debit = Credit balance)
│
└── RCLimit.Modules.Accounting.Contracts/
    ├── IAccountingModuleApi.cs       (Module public C# interface)
    └── Dtos/
        ├── JournalEntryDto.cs
        └── LedgerAccountDto.cs

```

## 6. MassTransit Event Integration & Compensating Sagas
The Accounting Module integrates asynchronously with other platform modules using MassTransit Integration Events[cite: 7]:

```Plaintext
[Loans Module]                  [MassTransit Bus]               [Accounting Module]
      │                                 │                                 │
      ├─ 1. LoanDisbursalStarted ─────► │                                 │
      │   (Payload: LoanId, Amounts)    │                                 │
      │                                 ├─ 2. Consume Event ────────────► │
      │                                 │                                 ├─ 3. Validate Debit = Credit
      │                                 │                                 ├─ 4. Insert Journal & Lines
      │                                 │ ◄─ 5. JournalPostingSucceeded ──┤
      │ ◄─ 6. Update Saga State ────────┤                                 │
```


### Compensating Reversals
If a downstream transaction fails (e.g., sub-broker commission error), the Accounting Module does not delete or mutate existing records[cite: 7]. Instead, it executes a compensating command (ReverseJournalEntryCommand) that posts an exact equal-and-opposite reversing journal entry with a narration reference to the original journal_id[cite: 7].
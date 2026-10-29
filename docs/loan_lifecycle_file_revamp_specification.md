# RCLimit System Requirements Specification: Loan Application File, Lifecycle, PDD & RC Limit Ledger Revamp (Version 4.0)

**Document Type:** Technical Domain & Functional Requirements Specification  
**Module Name:** `RCLimit.Modules.Loans` / `RCLimit.Modules.Accounting`  
**Database Schemas:** `public`, `accounting`, `system`  
**System Name:** **RCLimit Engine**  
**Operational Unit:** Anna Finance (DSA of Commercial Vehicles, Bharuch, Gujarat)  
**Status:** Updated Specification Baseline  
**Date:** October 2026  

---

## 1. Executive Summary & Module Scope

This specification re-architects the **Loans Module** (`RCLimit.Modules.Loans`) from a basic disbursal log into a full-featured **Loan Origination & Servicing System (LOS/LSS)**.

Under the revamped design:
- Initiating a loan creates a **Loan Application File** that progresses through an explicit multi-stage state machine (`NEW`, `DOCUMENTS_PENDING`, `LOGGED_IN`, `CREDIT_REVIEW`, `SANCTIONED`, `REJECTED`, `WITHDRAWN`, `DISBURSED`, `CLOSED`).
- Supports three credit products: **Used Vehicle (RC Limit)**, **New Vehicle**, and **Refinance**.
- Captures status-specific lifecycle milestones (`logged_in_date`, `sanction_date`, `disbursal_date`, `emi_start_date`), monthly EMI collection call reminders, and threaded operational comments.
- Enforces **Post-Disbursal Document (PDD) Tracking** (RC Smartcard, Insurance Bank Clause, Form 35).
- Introduces an **RC Limit Ledger Report & Routing Engine**, allowing loans to be disbursed either to the Customer or to **Anna Finance**, with automated baseline initial credit posting and real-time running balance calculations.

---

## 2. Multi-Product Capabilities

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Supported Loan Products                                 │
├──────────────────────────────┬──────────────────────────────┬───────────────────────────┤
│ 1. Used Vehicle (RC Limit)   │ 2. New Vehicle Loan          │ 3. Refinance Loan         │
├──────────────────────────────┼──────────────────────────────┼───────────────────────────┤
│ • Revolving sub-limit draw   │ • Direct dealership invoice  │ • Balance transfer /      │
│ • Vahan RC check mandatory   │ • Dealer payment disbursement│   equity cash-out         │
│ • 30–45 Day RC SLA clock     │ • Interim RTO allocation     │ • Foreclosure payout for  │
│ • Stop-supply enforcement    │ • No RC aging SLA clock      │   existing lender         │
│ • Disbursed to Customer or   │                              │                           │
│   Anna Finance (Ledger)      │                              │                           │
└──────────────────────────────┴──────────────────────────────┴───────────────────────────┘
```

1. **Used Vehicle (RC Limit):** Standard revolving credit facility for used commercial vehicles. Requires Vahan verification, customer sub-limit check, 30–45 day RC SLA clock tracking, PDD submission, stop-supply enforcement, and RC Limit Ledger routing.
2. **New Vehicle Loan:** Financing for brand-new commercial vehicle purchases with proforma invoice validation and direct payment to OEM/dealer accounts.
3. **Refinance Loan:** Unlocking equity or transferring balances from existing loans on commercial vehicles.

---

## 3. Loan Application File State Machine

```text
  [NEW] ──► [DOCUMENTS_PENDING] ──► [LOGGED_IN] ──► [CREDIT_REVIEW]
   │                │                    │                 │
   ├──► [WITHDRAWN]  ├──► [WITHDRAWN]     ├──► [REJECTED]   ├──► [SANCTIONED]
   │                │                    │                 │        │
   │                │                    │                 │        ├──► [DISBURSED] ──► [PDD_PENDING / IN_PROGRESS]
   │                │                    │                 │        │        │
   │                │                    │                 │        │        └──► [CLOSED]
   │                │                    │                 │        │
   └────────────────┴────────────────────┴─────────────────┴────────┴──► [WITHDRAWN]
```

### State Matrix & Milestone Capture Rules

| State Name | Allowed Next States | Milestone Fields Captured | Validation & Business Rules |
| :--- | :--- | :--- | :--- |
| **`NEW`** | `DOCUMENTS_PENDING`, `LOGGED_IN`, `WITHDRAWN` | Created Date, Application Number | Inbound file created; basic applicant and product details captured. |
| **`DOCUMENTS_PENDING`** | `LOGGED_IN`, `WITHDRAWN` | Checklist items flagged | System tracks missing KYC, Vahan RC, or bank statements. |
| **`LOGGED_IN`** | `CREDIT_REVIEW`, `REJECTED`, `WITHDRAWN` | **`logged_in_date`**, Lender File No | Complete file submitted to Bank/NBFC portal. |
| **`CREDIT_REVIEW`** | `SANCTIONED`, `REJECTED`, `WITHDRAWN` | Underwriter Notes, Field Inspection | Bank credit team evaluates CIBIL, vehicle valuation, and LTV. |
| **`SANCTIONED`** | `DISBURSED`, `REJECTED`, `WITHDRAWN` | **`sanction_date`**, Approved Amt, Tenure, Rate | Bank sanction letter issued. Sub-limit headroom checked for Used CV. |
| **`REJECTED`** | *(Terminal)* | Rejection Reason, Rejection Date | Bank/NBFC declines file; lead archived. |
| **`WITHDRAWN`** | *(Terminal)* | Withdrawal Reason, Withdrawal Date | Applicant or dealer cancels request before disbursal. |
| **`DISBURSED`** | `CLOSED` | **`disbursal_date`**, **`emi_start_date`**, **`emi_due_day`** | Funds released. Sub-limit utilized; PDD checklist generated; RC Limit Ledger populated if disbursed to Anna Finance; journal entries posted. |
| **`CLOSED`** | *(Terminal)* | Closure Date, NOC Status | Loan fully repaid or all PDDs submitted & accepted by lender. Sub-limit restored. |

---

## 4. RC Limit Ledger & Disbursal Beneficiary Engine

### A. Dual Disbursal Beneficiary Routing
When executing a loan disbursal, the operator specifies the **Disbursal Beneficiary Type**:
* `CUSTOMER_DIRECT`: Funds released directly to the borrower/dealer bank account.
* `ANNA_FINANCE_CLEARING`: Funds released to Anna Finance's master bank account for staged settlement, line-item deductions, and payout management.

### B. The Missing First Entry Fix
Previously, line-item deductions were logged without the initial credit record, obscuring the original baseline amount. Under this specification:

When `disbursement_beneficiary == 'ANNA_FINANCE_CLEARING'`, the system automatically creates **Row 1 in `disbursal_line_items`**:
* **Particular Type:** `INITIAL_BANK_DISBURSAL_RELEASE`
* **Entry Direction:** `CREDIT`
* **Amount:** Gross Sanctioned Amount / Initial Release Amount
* **Running Balance:** Set to Gross Amount.

Subsequent deductions (`RTO_CHARGES`, `INSURANCE_PAYMENT`, `VALUATION_FEES`, `CONVENIENCE_FEES`) are recorded as **`DEBIT`** entries, dynamically reducing `running_balance_amt` until the net release to the customer/seller clears the balance to ₹0.00.

```text
RC Limit Ledger Entry Lifecycle (Example: ₹15,00,000 Sanction)
───────────────────────────────────────────────────────────────────────────────────
Seq  Particular Type                  Direction    Amount (₹)   Running Balance (₹)
───────────────────────────────────────────────────────────────────────────────────
1    INITIAL_BANK_DISBURSAL_RELEASE   CREDIT     15,00,000.00         15,00,000.00  <-- Auto-Generated Row 1
2    CONVENIENCE_FEES                 DEBIT         10,000.00         14,90,000.00
3    RTO_CHARGES                      DEBIT         10,000.00         14,80,000.00
4    INSURANCE_PAYMENT                DEBIT          5,000.00         14,75,000.00
5    PAYMENT_TO_BROKER_SELLER         DEBIT      14,75,000.00                 0.00  <-- Net Settlement
```

### C. Dedicated UI Menu: "RC Limit Ledger"
A separate navigation item (**RC Limit Ledger**) provides a dedicated reporting view:
* **Filters:** Customer/Dealer Name, Bank Pool, Vehicle Reg Number, Date Range, Status (`OPEN_BALANCE` vs `SETTLED`).
* **Columns:** Disbursal Date, Loan Application No, Customer Name, Vehicle Reg, Lender Pool, Initial Release Amount (Credit), Total Deductions (Debit), Net Disbursed, and Active Balance.
* **Drill-Down:** Clicking any ledger row opens the full line-item voucher breakdown and corresponding double-entry journal postings in the `accounting` schema.

---

## 5. Post-Disbursal Document (PDD) Tracking Engine

Upon loan disbursal, lenders enforce strict Post-Disbursal Document (PDD) compliance timeframes (30–45 days).

### Core PDD Document Types & Individual Status Machine
1. **Updated Smartcard RC (Hypothecation Endorsed)**
2. **Insurance Policy with Bank Clause**
3. **RTO Form 35 Acknowledgment**
4. **Original Vehicle Tax Receipt / Invoice**
5. **Customer Delivery Receipt / Possession Proof**

```text
  [PENDING] ──► [SUBMITTED_TO_BROKER] ──► [VERIFIED_BY_OPS] ──► [SUBMITTED_TO_BANK] ──► [ACCEPTED_BY_BANK]
     │                   │                       │                                         ▲
     └───────────────────┴───────────────────────┴──────► [REJECTED_OVERDUE] ──────────────┘
```

---

## 6. Servicing & Operational Call Reminders

1. **Dynamic Due Dates:** Captures `emi_start_date`, `emi_due_day` (e.g., 5th of every month), and `emi_amount` upon disbursal.
2. **Monthly Call Queue:** Generates an operational call queue 5 days prior to `emi_due_day`.
3. **Servicing Log Entry:** Records `call_result` (`ANSWERED_PROMISED`, `ANSWERED_PAID`, `NO_ANSWER`, `WRONG_NUMBER`, `REFUSED`), `promised_payment_date`, and agent remarks.

---

## 7. Database Schema DDL (`public` Schema)

```sql
-- 1. ENUM Types
CREATE TYPE loan_product_type AS ENUM ('USED_CV', 'NEW_CV', 'REFINANCE');

CREATE TYPE loan_file_status AS ENUM (
    'NEW', 
    'DOCUMENTS_PENDING', 
    'LOGGED_IN', 
    'CREDIT_REVIEW', 
    'SANCTIONED', 
    'REJECTED', 
    'WITHDRAWN', 
    'DISBURSED', 
    'CLOSED'
);

CREATE TYPE disbursal_beneficiary_type AS ENUM ('CUSTOMER_DIRECT', 'ANNA_FINANCE_CLEARING');

CREATE TYPE pdd_document_status AS ENUM (
    'PENDING', 
    'SUBMITTED_TO_BROKER', 
    'VERIFIED_BY_OPS', 
    'SUBMITTED_TO_BANK', 
    'ACCEPTED_BY_BANK', 
    'REJECTED_OVERDUE'
);

-- 2. Master Loan Application Files Table
CREATE TABLE public.loan_transactions (
    loan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    application_number VARCHAR(50) UNIQUE NOT NULL,
    lender_agreement_number VARCHAR(50),
    
    -- Relationships
    customer_id UUID NOT NULL REFERENCES public.customers(customer_id),
    vehicle_id UUID REFERENCES public.vehicles(vehicle_id),
    pool_id UUID REFERENCES public.master_bank_pools(pool_id),
    partner_id UUID REFERENCES public.partners(partner_id),
    
    -- Product, Status & Beneficiary Routing
    product_type loan_product_type NOT NULL DEFAULT 'USED_CV',
    file_status loan_file_status NOT NULL DEFAULT 'NEW',
    disbursal_beneficiary disbursal_beneficiary_type DEFAULT 'ANNA_FINANCE_CLEARING',
    
    -- Financial Parameters
    requested_amount DECIMAL(15,2) NOT NULL,
    sanctioned_amount DECIMAL(15,2) DEFAULT 0.00,
    net_disbursed_amount DECIMAL(15,2) DEFAULT 0.00,
    customer_rate DECIMAL(5,2) DEFAULT 0.00,
    tenure_months INT DEFAULT 12,
    emi_amount DECIMAL(12,2) DEFAULT 0.00,
    
    -- Payout Commissions
    bank_payout_pct_amt DECIMAL(10,2) DEFAULT 0.00,
    bonus_payout_amt DECIMAL(10,2) DEFAULT 0.00,
    shared_payout_amt DECIMAL(10,2) DEFAULT 0.00,
    total_payout_earned DECIMAL(10,2) GENERATED ALWAYS AS (bank_payout_pct_amt + bonus_payout_amt - shared_payout_amt) STORED,
    
    -- Milestone Dates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logged_in_date DATE,
    sanction_date DATE,
    disbursal_date DATE,
    closed_date DATE,
    rejection_withdrawn_date DATE,
    rejection_withdrawn_reason TEXT,
    
    -- PDD SLA Clock Tracking
    pdd_due_date DATE,
    pdd_overall_status VARCHAR(30) DEFAULT 'PENDING' CHECK (pdd_overall_status IN ('PENDING', 'PARTIAL', 'COMPLIANT', 'OVERDUE_STOP_SUPPLY')),
    
    -- Servicing Attributes
    emi_start_date DATE,
    emi_due_day INT CHECK (emi_due_day BETWEEN 1 AND 31),
    last_reminder_call_date TIMESTAMP WITH TIME ZONE,
    next_reminder_due_date DATE,
    
    created_by_user_id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loans_tenant_status ON public.loan_transactions(tenant_id, file_status);
CREATE INDEX idx_loans_beneficiary ON public.loan_transactions(tenant_id, disbursal_beneficiary);

-- 3. Enhanced Disbursal Line Items Table (Supports Credit Opening & Debit Line Items)
CREATE TABLE public.disbursal_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loan_transactions(loan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    
    particular_type VARCHAR(50) NOT NULL, -- 'INITIAL_BANK_DISBURSAL_RELEASE', 'RTO_CHARGES', 'INSURANCE_PAYMENT', etc.
    entry_direction VARCHAR(10) NOT NULL CHECK (entry_direction IN ('CREDIT', 'DEBIT')),
    
    mode_of_payment VARCHAR(20),
    bank_name VARCHAR(100),
    account_no VARCHAR(50),
    transaction_id VARCHAR(100),
    
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    running_balance_amt DECIMAL(15,2) NOT NULL,
    
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_items_loan ON public.disbursal_line_items(loan_id, created_at ASC);

-- 4. PDD Checklist Table
CREATE TABLE public.loan_pdd_documents (
    pdd_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loan_transactions(loan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    
    document_type VARCHAR(50) NOT NULL,
    document_title VARCHAR(150) NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    
    status pdd_document_status DEFAULT 'PENDING',
    due_date DATE NOT NULL,
    
    proof_file_url TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    verified_by_user_id UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    bank_submission_date DATE,
    bank_ack_reference VARCHAR(100),
    rejection_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Threaded Comments Table
CREATE TABLE public.loan_comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loan_transactions(loan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    author_user_id UUID NOT NULL,
    author_name VARCHAR(150) NOT NULL,
    author_role VARCHAR(50) NOT NULL,
    
    comment_type VARCHAR(30) DEFAULT 'GENERAL',
    comment_text TEXT NOT NULL,
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. EMI Call Reminders Table
CREATE TABLE public.loan_emi_reminders (
    reminder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loan_transactions(loan_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    caller_user_id UUID NOT NULL,
    
    call_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    call_result VARCHAR(40) NOT NULL,
    promised_payment_date DATE,
    remarks TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. API Taxonomy & RC Limit Ledger Endpoint

| Method | Route | Description | Request / Query Parameters |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/loans` | Create Loan File | `{ customerId, productType, requestedAmount, partnerId }` |
| **PATCH** | `/api/v1/loans/{id}/disburse` | Execute Disbursal & Init Ledger | `{ disbursalBeneficiary, sanctionedAmount, lineItems[] }` |
| **GET** | `/api/v1/accounting/rc-limit-ledger` | **Fetch RC Limit Ledger Report** | Query: `customerId`, `poolId`, `startDate`, `endDate`, `hasOpenBalance` |
| **GET** | `/api/v1/loans/{id}/pdd-checklist` | Fetch PDD Checklist | Path: `id` (UUID) |
| **POST** | `/api/v1/loans/{id}/comments` | Add Threaded Comment | `{ commentText, commentType }` |
| **POST** | `/api/v1/loans/{id}/emi-reminders` | Log Servicing Call | `{ callResult, promisedPaymentDate, remarks }` |

---

## 9. C# Implementation: Disbursal Execution with Initial Credit Entry

```csharp
namespace RCLimit.Modules.Loans.Application.Commands.DisburseLoan;

public record DisburseLoanCommand(
    Guid TenantId,
    Guid LoanId,
    string DisbursalBeneficiary, // "CUSTOMER_DIRECT" or "ANNA_FINANCE_CLEARING"
    decimal SanctionedAmount,
    DateTime DisbursalDate,
    DateTime EmiStartDate,
    int EmiDueDay,
    List<DisbursalLineItemDto> Deductions,
    Guid PerformedByUserId
) : IRequest<DisbursalExecutionResultDto>;

public class DisburseLoanCommandHandler : IRequestHandler<DisburseLoanCommand, DisbursalExecutionResultDto>
{
    private readonly RCLimitDbContext _dbContext;
    private readonly ILogger<DisburseLoanCommandHandler> _logger;

    public DisburseLoanCommandHandler(RCLimitDbContext dbContext, ILogger<DisburseLoanCommandHandler> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<DisbursalExecutionResultDto> Handle(DisburseLoanCommand request, CancellationToken cancellationToken)
    {
        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            var loan = await _dbContext.LoanTransactions
                .FirstOrDefaultAsync(l => l.LoanId == request.LoanId && l.TenantId == request.TenantId, cancellationToken);

            if (loan == null) throw new NotFoundException($"Loan '{request.LoanId}' not found.");
            if (loan.FileStatus != LoanFileStatus.SANCTIONED) 
                throw new DomainException("Only sanctioned loans can be disbursed.", "INVALID_STATUS", 422);

            loan.FileStatus = LoanFileStatus.DISBURSED;
            loan.DisbursalBeneficiary = Enum.Parse<DisbursalBeneficiaryType>(request.DisbursalBeneficiary);
            loan.SanctionedAmount = request.SanctionedAmount;
            loan.DisbursalDate = request.DisbursalDate;
            loan.EmiStartDate = request.EmiStartDate;
            loan.EmiDueDay = request.EmiDueDay;
            loan.PddDueDate = request.DisbursalDate.AddDays(45); // 45-day SLA
            loan.PddOverallStatus = "PENDING";

            decimal runningBalance = request.SanctionedAmount;

            // 1. AUTO-CREATE ROW 1: Initial Credit Entry (If disbursed to Anna Finance)
            if (loan.DisbursalBeneficiary == DisbursalBeneficiaryType.ANNA_FINANCE_CLEARING)
            {
                var initialCreditRow = new DisbursalLineItem
                {
                    LineItemId = Guid.NewGuid(),
                    LoanId = loan.LoanId,
                    TenantId = request.TenantId,
                    EntryDate = request.DisbursalDate,
                    ParticularType = "INITIAL_BANK_DISBURSAL_RELEASE",
                    EntryDirection = "CREDIT",
                    Amount = request.SanctionedAmount,
                    RunningBalanceAmt = runningBalance,
                    CreatedByUserId = request.PerformedByUserId
                };
                _dbContext.DisbursalLineItems.Add(initialCreditRow);
            }

            // 2. Process Line-Item Deductions (Debit Entries)
            foreach (var item in request.Deductions)
            {
                runningBalance -= item.Amount;

                var deductionRow = new DisbursalLineItem
                {
                    LineItemId = Guid.NewGuid(),
                    LoanId = loan.LoanId,
                    TenantId = request.TenantId,
                    EntryDate = request.DisbursalDate,
                    ParticularType = item.ParticularType,
                    EntryDirection = "DEBIT",
                    ModeOfPayment = item.ModeOfPayment,
                    BankName = item.BankName,
                    AccountNo = item.AccountNo,
                    TransactionId = item.TransactionId,
                    Amount = item.Amount,
                    RunningBalanceAmt = runningBalance,
                    CreatedByUserId = request.PerformedByUserId
                };
                _dbContext.DisbursalLineItems.Add(deductionRow);
            }

            loan.NetDisbursedAmount = runningBalance > 0 ? runningBalance : 0.00m;

            // 3. Initialize Mandatory PDD Items
            var pddTypes = new[] 
            { 
                ("UPDATED_RC_SMARTCARD", "Updated RC Smartcard (Bank Hypothecated)"), 
                ("INSURANCE_POLICY", "Insurance Policy with Bank Clause"),
                ("FORM_35_ACK", "RTO Form 35 Acknowledgment")
            };

            foreach (var (type, title) in pddTypes)
            {
                _dbContext.LoanPddDocuments.Add(new LoanPddDocument
                {
                    PddId = Guid.NewGuid(),
                    LoanId = loan.LoanId,
                    TenantId = request.TenantId,
                    DocumentType = type,
                    DocumentTitle = title,
                    IsMandatory = true,
                    Status = PddDocumentStatus.PENDING,
                    DueDate = loan.PddDueDate.Value
                });
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation("Loan {LoanId} successfully disbursed to {Beneficiary}. Initial Credit: {Sanction:C}, Net Payout: {Net:C}",
                loan.LoanId, loan.DisbursalBeneficiary, loan.SanctionedAmount, loan.NetDisbursedAmount);

            return new DisbursalExecutionResultDto(loan.LoanId, loan.NetDisbursedAmount, runningBalance);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Failed to execute disbursal for Loan {LoanId}", request.LoanId);
            throw;
        }
    }
}
```

---

## 10. Summary of Architectural Enhancements
1. **Explicit Beneficiary Selection:** Allows selecting `CUSTOMER_DIRECT` or `ANNA_FINANCE_CLEARING` during disbursal execution.
2. **Fixed First Ledger Entry:** Disbursing to Anna Finance automatically generates **Row 1 (`INITIAL_BANK_DISBURSAL_RELEASE`)** as a `CREDIT` entry to establish the baseline before debit deductions are applied.
3. **Dedicated RC Limit Ledger View:** Provides a dedicated screen and endpoint (`/api/v1/accounting/rc-limit-ledger`) to monitor active balances across Anna Finance clearing accounts.
# RC Limit Management System: System Requirements Specification & Entity Data Model

**Document Type:** Business & Technical Specification  
**Perspective:** RC Limit Broker / Aggregator  
**Status:** Version 1.2 (Vetted with Broker Sheets)  
**Operational Unit:** Anna Finance (DSA of Commercial Vehicles)  
**Date:** August 2026  

---

## 1. Executive Summary & Domain Context

An **RC Limit Broker** (e.g., *Anna Finance - DSA of Commercial Vehicles*) acts as a critical financial and operational bridge between institutional lenders (Banks/NBFCs like *Chola*, *HDFC*, *ICICI*) and used car dealerships or individual commercial vehicle buyers. The broker negotiates aggregate credit lines (Registration Certificate Limits) from multiple lenders and redistributes this working capital to dealers for financing inventory or customer vehicle acquisitions.

Because vehicle loans remain technically uncollateralized until the updated Registration Certificate (RC) bearing the bank's hypothecation mark is issued by the Regional Transport Office (RTO), lenders enforce strict submission timeframes (typically 30–60 days). The broker assumes the compliance risk: if dealers accumulate past-due RCs, the bank freezes the broker's aggregate line ("Stop-Supply").

> **Primary System Objective:** To provide the broker with a centralized operational platform that manages dual-ledger accounting (Bank-to-Broker and Broker-to-Customer), automates risk underwriting (CIBIL bureau pulls and Vahan RC checks), enforces dealer sub-limits and stop-supply guardrails, tracks granular disbursal line-item deductions (RTO, Insurance, Valuation, Foreclosure), and calculates broker commissions and shared payouts.

---

## 2. End-to-End Business Lifecycle Flow

When a used car dealer or customer approaches the broker for inventory or purchase financing, the transaction progresses through six distinct operational phases:

| Phase | Stage Name | Operational Actions | System & Financial Impact |
| :---: | :--- | :--- | :--- |
| **01** | **Intake & Underwriting** | Broker captures loan request, runs automated **CIBIL bureau pull** on borrower and **Vahan RC check** on vehicle (checking blacklists, tax, and existing hypothecation). | System evaluates risk profile against lender criteria and assigns loan-to-value (LTV) and interest rate markup. |
| **02** | **Bank Disbursal** | Broker routes approved file to chosen Bank pool (e.g., `FINANCE NAME` / `FINANCED BY`: Chola). Bank approves `LOAN AMOUNT` and disburses funds to broker's account minus bank processing fees. | System logs entry in **Bank-to-Broker Ledger** (Liability owed to Bank @ Wholesale Bank Rate). |
| **03** | **Customer Disbursal** | System checks dealer's active RC aging and available sub-limit. Broker prepares disbursal advice voucher, calculating `DISBURSEMENT AMT` after deducting line items (`RTO CHARGES`, `INSSRUANCE PAYMENT`, `CONVENINECE FEES`, `APPROX FORECLOSER`, `PAYMENT TO BROKER/SELLER`, `VALUATION FEES`). | System logs entry in **Broker-to-Customer Ledger** (Asset owed by Dealer @ Retail Customer Rate). Sub-limit utilized. |
| **04** | **RC Aging Clock** | Funds released; 30/45-day RC submission countdown starts. Automated WhatsApp/SMS alerts triggered at days 15, 22, and 28. | Daily accrual of net interest spread ($	ext{Customer Rate} - 	ext{Bank Rate}$) and commission tracking (`PAYOUT`, `BOUNS PAYOUT`, `SHARED PAYOUT`). |
| **05** | **Document Upload & Verification** | Dealer uploads interim RTO acknowledgement slip or final updated RC smartcard. Broker ops team verifies proof against government databases. | Document status transitions to `RC_Submitted`. Verified RC pushed to Bank portal. |
| **06** | **Clearance & Unlocking** | Bank accepts RC submission. File marked fully compliant. Dealer's credit sub-limit headroom is restored. | Dealer's `pending_rc_count` decreases. Headroom unlocked for next vehicle loan. |

> **The Stop-Supply Trigger Rule:** If an active vehicle loan reaches its maximum SLA (e.g., 45 days) without an approved RC submission, the system automatically sets the dealer's `stop_supply_flag = TRUE`. This instantly locks all further loan disbursals to that dealer across *all* partner bank pools until the backlog is cleared.

---

## 3. Architecture & Entity Relationship Model

The system data model is structured around five interconnected operational pillars:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        IDENTITY & CREDIT FACILITIES                    │
│                                                                        │
│   ┌──────────────┐ 1:N  ┌─────────────────┐ 1:N  ┌─────────────────┐   │
│   │    Lender    ├─────►│ MasterBankPool  ├─────►│ LoanTransaction │   │
│   └──────────────┘      └─────────────────┘      └────────▲────────┘   │
│                                                           │            │
│   ┌──────────────┐ 1:1  ┌─────────────────┐ 1:N           │ 1:N        │
│   │   Customer   ├─────►│ CustomerSubLimit├───────────────┤            │
│   └──────┬───────┘      └─────────────────┘               │            │
└──────────┼────────────────────────────────────────────────┼────────────┘
           │                                                │
           │ 1:N                                            │ 1:N
           ▼                                                ▼
┌─────────────────────────────┐            ┌─────────────────────────────┐
│  VEHICLES & VERIFICATIONS   │            │   DISBURSEMENT DEDUCTIONS   │
│                             │            │                             │
│   ┌─────────────────────┐   │            │   ┌─────────────────────┐   │
│   │       Vehicle       │◄──┼────────────┼───┤  DisbursalLineItem  │   │
│   └──────────┬──────────┘   │            │   └─────────────────────┘   │
│              │ 1:N          │            │                             │
│              ▼              │            │   LOAN CORE & DOCUMENTS     │
│   ┌─────────────────────┐   │            │   ┌─────────────────────┐   │
│   │   VerificationLog   │   │            │   │  LoanTransaction    │   │
│   └─────────────────────┘   │            │   └──────────┬──────────┘   │
└─────────────────────────────┘            │              │ 1:1          │
                                           │              ▼              │
                                           │   ┌─────────────────────┐   │
                                           │   │  RCPipelineTracker  │   │
                                           │   └─────────────────────┘   │
                                           └─────────────────────────────┘
                                                            │
                                                            │ 1:N
                                                            ▼
                                           ┌─────────────────────────────┐
                                           │   DUAL-LEDGER ACCOUNTING    │
                                           │                             │
                                           │   ┌─────────────────────┐   │
                                           │   │    JournalEntry     │   │
                                           │   └──────────┬──────────┘   │
                                           │              │ 1:N          │
                                           │              ▼              │
                                           │   ┌─────────────────────┐   │
                                           │   │   LedgerLineItem    │   │
                                           │   └──────────▲──────────┘   │
                                           │              │ N:1          │
                                           │   ┌──────────┴──────────┐   │
                                           │   │    LedgerAccount    │   │
                                           │   └─────────────────────┘   │
                                           └─────────────────────────────┘
```

---

## 4. Detailed Entity Dictionary

### Pillar 1: Identity & Credit Line Management

#### 1. `Lender`
* **Business Purpose:** Represents financial institutions (Banks/NBFCs like *Chola*, *HDFC*, *ICICI*, *Bajaj Finance*) that grant wholesale credit lines and RC limits to the broker.
* **Excel Source Mapping:** Mapped from `FINANCE NAME` *(Image 1)* and `FINANCED BY` *(Image 2)*.
* **Attributes:**
  * `lender_id` *(PK, UUID / BIGINT)*: Unique identifier for the banking partner.
  * `name` *(VARCHAR(100))*: Official institution name (e.g., "Chola", "IDFC First Bank"). **[Mapped from Excel: `FINANCE NAME` / `FINANCED BY`]**
  * `code` *(VARCHAR(20))*: System reference code / slug (e.g., `CHOLA_CV`).
  * `base_interest_rate` *(DECIMAL(5,2))*: Annual wholesale interest rate charged by bank to broker (e.g., 11.00%).
  * `default_tenure_limit_days` *(INT)*: Max allowed days for RC smartcard submission (e.g., 30, 45, or 60 days).
  * `contact_person_details` *(JSONB)*: Nodal officer contact, email, and escalation details.
  * `status` *(ENUM)*: `ACTIVE`, `SUSPENDED`, `INACTIVE`.

#### 2. `MasterBankPool`
* **Business Purpose:** Tracks aggregate bulk funding pools sanctioned by a specific lender under the broker's umbrella facility.
* **Attributes:**
  * `pool_id` *(PK, UUID / BIGINT)*: Unique pool identifier.
  * `lender_id` *(FK $ightarrow$ Lender)*: Reference to parent `Lender`.
  * `facility_account_number` *(VARCHAR(50))*: Bank sanction account reference string.
  * `sanctioned_limit` *(DECIMAL(15,2))*: Total approved bulk credit line (e.g., ₹50,000,000.00).
  * `utilized_amount` *(DECIMAL(15,2))*: Sum of active outstanding principal currently drawn.
  * `available_limit` *(CALCULATED, DECIMAL(15,2))*: `sanctioned_limit - utilized_amount`.
  * `sanction_date` / `expiry_date` *(DATE)*: Facility validity date range.
  * `status` *(ENUM)*: `ACTIVE`, `FROZEN`, `EXPIRED`.

#### 3. `Customer`
* **Business Purpose:** Stores master identity data for the broker's direct clients—primarily Used Car Dealers borrowing inventory lines, and retail car/CV buyers.
* **Excel Source Mapping:** Mapped from `CUSTOMER NAME` *(Image 1)* and `NAME` *(Image 2)*.
* **Attributes:**
  * `customer_id` *(PK, UUID / BIGINT)*: Unique client identifier.
  * `customer_type` *(ENUM)*: `DEALER` (Commercial Dealership), `INDIVIDUAL` (Retail Buyer).
  * `legal_name` *(VARCHAR(150))*: Full legal name of applicant (e.g., "JIVA WASIM MEHMUD"). **[Mapped from Excel: `CUSTOMER NAME` / `NAME`]**
  * `trade_name` *(VARCHAR(150))*: Yard trading name for dealers (e.g., "Apex Motors").
  * `phone_number` / `email` *(VARCHAR(50))*: Primary contact credentials.
  * `pan_number` / `gstin` *(VARCHAR(20))*: Tax identity registration numbers.
  * `cibil_score` *(INT)*: Latest pulled credit bureau score (e.g., 740).
  * `cibil_tier` *(ENUM)*: `GREEN` (750+), `AMBER` (650-749), `RED` (<650).
  * `kyc_status` *(ENUM)*: `PENDING`, `VERIFIED`, `REJECTED`.
  * `risk_status` *(ENUM)*: `ACTIVE`, `STOP_SUPPLY_LOCKED`, `SUSPENDED`.

#### 4. `CustomerSubLimit`
* **Business Purpose:** Manages individual credit limits and document compliance caps assigned by the broker to a specific Used Car Dealer.
* **Attributes:**
  * `sub_limit_id` *(PK, UUID / BIGINT)*: Unique sub-limit record ID.
  * `customer_id` *(FK $ightarrow$ Customer)*: Reference to parent dealer `Customer`.
  * `assigned_ceiling` *(DECIMAL(15,2))*: Maximum borrowing limit granted to dealer (e.g., ₹5,000,000.00).
  * `current_utilization` *(DECIMAL(15,2))*: Active principal borrowed across open loans.
  * `available_sub_limit` *(CALCULATED, DECIMAL(15,2))*: `assigned_ceiling - current_utilization`.
  * `pending_rc_count` *(INT)*: Current count of active loans awaiting final RC submission.
  * `max_pending_rc_allowed` *(INT)*: Maximum unsubmitted RCs allowed simultaneously (e.g., 5 cars).
  * `stop_supply_flag` *(BOOLEAN)*: System enforcement trigger (`TRUE` locks all new disbursals).

---

### Pillar 2: Vehicle & Verification Pipeline

#### 5. `Vehicle`
* **Business Purpose:** Represents the physical automobile/commercial vehicle being financed as loan collateral, holding specifications required for valuation and RTO tracking.
* **Excel Source Mapping:** Mapped from `Reg No` *(Image 1)* and `REGIRSATION NO` *(Image 2)*.
* **Attributes:**
  * `vehicle_id` *(PK, UUID / BIGINT)*: Unique vehicle record ID.
  * `registration_number` *(VARCHAR(20))*: Official license plate number (e.g., `GJ05BX6637`). **[Mapped from Excel: `Reg No` / `REGIRSATION NO`]**
  * `chassis_number` / `engine_number` *(VARCHAR(50))*: Unique manufacturing stamp IDs.
  * `make` / `model` / `variant` *(VARCHAR(50))*: Vehicle specifications (e.g., Tata, Prima, 2830.K).
  * `year_of_mfg` *(INT)*: Manufacturing year (used for age-based LTV capping).
  * `ownership_count` *(INT)*: Serial owner count (1st Owner, 2nd Owner, etc.).
  * `current_rto_status` *(ENUM)*: `CLEAN`, `HYPOTHECATED`, `BLACKLISTED`, `CHALLAN_PENDING`.

#### 6. `VerificationLog`
* **Business Purpose:** Stores raw JSON API response payloads and audit trails from credit bureaus (CIBIL) and government databases (Vahan / Parivahan).
* **Attributes:**
  * `verification_id` *(PK, UUID / BIGINT)*: Unique verification log ID.
  * `vehicle_id` / `customer_id` *(FK $ightarrow$ Vehicle / Customer, Nullable)*: References to target entities.
  * `verification_type` *(ENUM)*: `CIBIL_PULL`, `VAHAN_RC_LOOKUP`, `CHALLAN_CHECK`.
  * `request_payload` / `response_payload` *(JSONB)*: Complete raw API payloads for audit defense.
  * `result_status` *(ENUM)*: `PASSED`, `FLAGGED`, `FAILED`.
  * `executed_at` *(TIMESTAMP)*: Exact timestamp of query execution.

---

### Pillar 3: Loan Core & Disbursal Breakdowns

#### 7. `LoanTransaction`
* **Business Purpose:** The primary contract record connecting Customer, Vehicle, Bank Pool, Rates, Broker Commissions, and Net Disbursals.
* **Excel Source Mapping:** Mapped directly from headers in Image 1 (`USED CV VEHICLES`) and Image 2 (`ANNA FINANCE Advice Voucher`).
* **Attributes:**
  * `loan_id` *(PK, UUID / BIGINT)*: Unique loan transaction ID.
  * `serial_number` *(INT)*: System serial index. **[Mapped from Excel: `SR NO` / `S.NO`]**
  * `loan_number` *(VARCHAR(30))*: Human-readable system code (e.g., `LN-2026-0089`).
  * `lender_agreement_number` *(VARCHAR(50))*: Bank sanction agreement reference ID (e.g., `0`). **[Mapped from Excel: `AGREEMENT NO`]**
  * `customer_id` / `vehicle_id` / `pool_id` *(FK $ightarrow$ Customer, Vehicle, MasterBankPool)*: Foreign links to core entities.
  * `product_type` *(ENUM)*: `USED_CV` (Used Commercial Vehicle), `NEW_CV`, `REFINANCE`, `USED_CAR`. **[Mapped from Excel: `PRODUCT` / Sheet Title: `USED CV VEHICLS`]**
  * `sanctioned_amount` *(DECIMAL(15,2))*: Total loan sanction amount (e.g., ₹15,19,490.00). **[Mapped from Excel: `LOAN AMOUNT`]**
  * `net_disbursed_amount` *(DECIMAL(15,2))*: Net payout after deductions (e.g., ₹14,76,201.00). **[NEW FIELD - Mapped from Excel: `DISBURSEMENT AMT`]**
  * `disbursal_date` *(DATE)*: Fund release date (e.g., `28 March 2026`). **[Mapped from Excel: `DATE`]**
  * `customer_rate` *(DECIMAL(5,2))*: Retail interest rate applied to borrower. **[Mapped from Excel: `RATE`]**
  * `bank_payout_pct_amt` *(DECIMAL(10,2))*: Base commission earned from lender. **[NEW FIELD - Mapped from Excel: `PAYOUT`]**
  * `bonus_payout_amt` *(DECIMAL(10,2))*: Additional volume incentive from lender. **[NEW FIELD - Mapped from Excel: `BOUNS PAYOUT`]**
  * `shared_payout_amt` *(DECIMAL(10,2))*: Commission shared downstream with sub-broker/dealer. **[NEW FIELD - Mapped from Excel: `SHARED PAYOUT`]**
  * `total_payout_earned` *(CALCULATED, DECIMAL(10,2))*: Net commission earned (`PAYOUT + BOUNS PAYOUT - SHARED PAYOUT`). **[NEW FIELD - Mapped from Excel: `TOTAL PAYOUT EARN`]**
  * `loan_status` *(ENUM)*: `SUBMITTED`, `SANCTIONED`, `DISBURSED_RC_PENDING`, `RC_SUBMITTED`, `CLOSED`, `DEFAULTED`. **[Mapped from Excel: `STATUS`]**
  * `remarks` *(TEXT)*: Operational notes. **[NEW FIELD - Mapped from Excel: `REMARKS`]**

#### 8. `DisbursalLineItem` *(NEW ENTITY)*
* **Business Purpose:** Captures itemized financial deductions and payouts that reduce total gross loan sanction amount down to the final net disbursal amount (`DISBURSEMENT AMT`).
* **Excel Source Mapping:** Created directly from Image 2 bottom table and Image 3 dropdown (`PARTICULAR`).
* **Attributes:**
  * `line_item_id` *(PK, UUID / BIGINT)*: Unique line-item ID.
  * `loan_id` *(FK $ightarrow$ LoanTransaction)*: Parent loan record.
  * `entry_date` *(DATE)*: Transaction line item date. **[Mapped from Excel: `DATE`]**
  * `particular_type` *(ENUM)*: Financial deduction/payout category. **[NEW FIELD - Mapped from Excel: `PARTICULAR` dropdown]**
    * `PAYMENT_TO_APPLICANT` *(Direct payout to borrower)* **[Excel dropdown item]**
    * `PAYMENT_TO_BROKER_SELLER` *(Payment to car seller / yard dealer)* **[Excel dropdown item: `PAYMENT TO BROKER/SELLER`]**
    * `RTO_CHARGES` *(RTO transfer & hypothecation fees)* **[Excel dropdown item: `RTO CHARGES`]**
    * `INSSRUANCE_PAYMENT` *(Insurance premium deduction)* **[Excel dropdown item: `INSSRUANCE PAYMENT`]**
    * `CONVENINECE_FEES` *(Broker processing & handling charge)* **[Excel dropdown item: `CONVENINECE FEES`]**
    * `APPROX_FORECLOSER` *(Payoff amount to close prior loan)* **[Excel dropdown item: `APPROX FORECLOSER`]**
    * `VALUATION_FEES` *(Vehicle inspection charges)* **[Excel dropdown item: `VALUATION FEES`]**
  * `mode_of_payment` *(ENUM)*: `NEFT`, `RTGS`, `CHEQUE`, `CASH`, `INTERNAL_TRANSFER`. **[NEW FIELD - Mapped from Excel: `MODE OF PAYMENT`]**
  * `bank_name` *(VARCHAR(100))*: Remittance bank name. **[NEW FIELD - Mapped from Excel: `BANK NAME`]**
  * `account_no` *(VARCHAR(50))*: Beneficiary bank account number. **[NEW FIELD - Mapped from Excel: `ACCOUNT NO`]**
  * `transaction_id` *(VARCHAR(100))*: UTR / Banking reference number. **[NEW FIELD - Mapped from Excel: `TRANSACTION ID`]**
  * `debit_amount` *(DECIMAL(15,2))*: Line item deduction amount. **[NEW FIELD - Mapped from Excel: `DEBIT AMT`]**
  * `running_balance_amt` *(DECIMAL(15,2))*: Remaining un-disbursed loan balance. **[NEW FIELD - Mapped from Excel: `BALANCE AMT`]**

#### 9. `RCPipelineTracker`
* **Business Purpose:** Powers the operational document aging engine, tracking RTO transfer stages, upload proofs, and compliance locks.
* **Attributes:**
  * `tracker_id` *(PK, UUID / BIGINT)*: Unique tracker record ID.
  * `loan_id` *(FK $ightarrow$ LoanTransaction, 1:1)*: Linked loan transaction ID.
  * `current_stage` *(ENUM)*: `DISBURSED_PENDING_RTO`, `RTO_ACK_SLIP_UPLOADED`, `FINAL_RC_UPLOADED`, `BANK_VERIFIED_CLEARED`.
  * `aging_days` *(CALCULATED, INT)*: Days elapsed since disbursal (`Current Date - disbursal_date`).
  * `aging_status` *(ENUM)*: `ON_TIME` (0-30 days), `WARNING_ZONE` (31-44 days), `OVERDUE_LOCK` (45+ days).
  * `rto_ack_doc_url` / `final_rc_doc_url` *(VARCHAR(255))*: Cloud document storage paths for proof files.
  * `ack_uploaded_at` / `rc_cleared_at` *(TIMESTAMP)*: Audit verification timestamps.

---

### Pillar 4: Dual-Ledger Financial Accounting

#### 10. `LedgerAccount`
* **Business Purpose:** Defines Chart of Accounts required for double-entry accounting across Bank and Customer sides.
* **Attributes:**
  * `account_id` *(PK, UUID / BIGINT)*: Unique ledger account ID.
  * `account_name` *(VARCHAR(100))*: Chart account name (e.g., "Chola Pool Debt", "Jiva Wasim Asset", "Anna Finance Commission Income").
  * `account_type` *(ENUM)*: `ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, `EXPENSE`.
  * `ledger_domain` *(ENUM)*: `BANK_TO_BROKER`, `BROKER_TO_CUSTOMER`, `INTERNAL_BROKER`.
  * `current_balance` *(DECIMAL(15,2))*: Real-time account balance.

#### 11. `JournalEntry` & `LedgerLineItem`
* **Business Purpose:** Grouped debit/credit accounting entries created whenever disbursals, line-item deductions, or payouts are executed.
* **Attributes:**
  * `journal_id` *(PK)*, `loan_id` *(FK)*, `entry_date`, `transaction_type` (`BANK_DISBURSAL`, `CUSTOMER_PAYOUT`, `FEE_DEDUCTION`).
  * `line_item_id` *(PK)*, `account_id` *(FK)*, `amount`, `entry_direction` (`DEBIT`, `CREDIT`).

---

## 5. Entity Mapping Matrix & Key Business Rules

### Comprehensive Attribute Cross-Reference Table

| Broker Excel Field Name | Screenshot Source | Mapped / New Entity | Entity Attribute Name | Data Type & Notes |
| :--- | :--- | :--- | :--- | :--- |
| **`SR NO` / `S.NO`** | Image 1 & 2 | `LoanTransaction` | `serial_number` | `INT` (Auto-index) |
| **`CUSTOMER NAME` / `NAME`** | Image 1 & 2 | `Customer` | `legal_name` | `VARCHAR` (e.g., "JIVA WASIM MEHMUD") |
| **`FINANCE NAME` / `FINANCED BY`**| Image 1 & 2 | `Lender` | `name` | `VARCHAR` (e.g., "CHOLA") |
| **`LOAN AMOUNT`** | Image 1 & 2 | `LoanTransaction` | `sanctioned_amount` | `DECIMAL(15,2)` (Gross sanction) |
| **`PRODUCT` / Sheet Header** | Image 1 | `LoanTransaction` | `product_type` | `ENUM` (e.g., `USED_CV`) |
| **`Reg No` / `REGIRSATION NO`** | Image 1 & 2 | `Vehicle` | `registration_number` | `VARCHAR` (e.g., "GJ05BX6637") |
| **`RATE`** | Image 1 | `LoanTransaction` | `customer_rate` | `DECIMAL(5,2)` |
| **`PAYOUT`** | Image 1 | `LoanTransaction` | `bank_payout_pct_amt` | **[NEW]** `DECIMAL(10,2)` (Base commission) |
| **`BOUNS PAYOUT`** | Image 1 | `LoanTransaction` | `bonus_payout_amt` | **[NEW]** `DECIMAL(10,2)` (Volume bonus) |
| **`STATUS`** | Image 1 | `LoanTransaction` | `loan_status` | `ENUM` |
| **`SHARED PAYOUT`** | Image 1 | `LoanTransaction` | `shared_payout_amt` | **[NEW]** `DECIMAL(10,2)` (Sub-agent cut) |
| **`TOTAL PAYOUT EARN`** | Image 1 | `LoanTransaction` | `total_payout_earned` | **[NEW]** `CALCULATED DECIMAL` |
| **`REMARKS`** | Image 1 | `LoanTransaction` | `remarks` | **[NEW]** `TEXT` |
| **`DISBURSEMENT AMT`** | Image 2 | `LoanTransaction` | `net_disbursed_amount` | **[NEW]** `DECIMAL(15,2)` (Net payout) |
| **`AGREEMENT NO`** | Image 2 | `LoanTransaction` | `lender_agreement_number` | **[NEW]** `VARCHAR` |
| **`DATE`** | Image 2 | `LoanTransaction` / `DisbursalLineItem` | `disbursal_date` / `entry_date` | `DATE` (e.g., "28 March 2026") |
| **`PARTICULAR`** | Image 2 & 3 | `DisbursalLineItem` | `particular_type` | **[NEW]** `ENUM` (Dropdown items) |
| **`MODE OF PAYMENT`** | Image 2 | `DisbursalLineItem` | `mode_of_payment` | **[NEW]** `ENUM` |
| **`BANK NAME`** | Image 2 | `DisbursalLineItem` | `bank_name` | **[NEW]** `VARCHAR` |
| **`ACCOUNT NO`** | Image 2 | `DisbursalLineItem` | `account_no` | **[NEW]** `VARCHAR` |
| **`TRANSACTION ID`** | Image 2 | `DisbursalLineItem` | `transaction_id` | **[NEW]** `VARCHAR` |
| **`DEBIT AMT`** | Image 2 | `DisbursalLineItem` | `debit_amount` | **[NEW]** `DECIMAL(15,2)` |
| **`BALANCE AMT`** | Image 2 | `DisbursalLineItem` | `running_balance_amt` | **[NEW]** `DECIMAL(15,2)` |

### Mandatory Validation & Enforcement Rules

1. **Disbursal Deduction Reconciliation:** The sum of all `DisbursalLineItem.debit_amount` entries must equal the difference between gross sanction and net payout:
   $$	ext{LOAN AMOUNT} - \sum (	ext{DEBIT AMT}) = 	ext{DISBURSEMENT AMT}$$
2. **Commission Spread Formula:** Net payout earnings earned by the broker are computed as:
   $$	ext{TOTAL PAYOUT EARN} = 	ext{PAYOUT} + 	ext{BOUNS PAYOUT} - 	ext{SHARED PAYOUT}$$
3. **Stop-Supply Enforcement:** If any vehicle loan under a dealer exceeds `Lender.default_tenure_limit_days` without an approved RC submission, set `CustomerSubLimit.stop_supply_flag = TRUE`.

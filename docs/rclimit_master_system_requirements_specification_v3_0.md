# RCLimit Management System: Complete Master System Requirements Specification & Architecture (Version 3.0)

**Document Type:** Complete Master Business & Technical Requirements Specification  
**System Name:** **RCLimit** (RCLimit Engine)  
**Operational Unit:** Anna Finance (DSA of Commercial Vehicles)  
**Location:** Bharuch, Gujarat, India  
**Perspective:** RC Limit Broker / Multi-Lender Aggregator / Multi-Tenant SaaS Platform  
**Status:** Baseline Specification (Multi-Repository, Multi-Tenant & Modular Monolith Architecture)  

---

## 1. Executive Summary & Domain Context

An **RC Limit Broker** (e.g., *Anna Finance - DSA of Commercial Vehicles*) operates as an intermediary between institutional lenders (Banks/NBFCs such as *Chola*, *HDFC*, *ICICI*, *Sundaram Finance*, *Shriram Finance*) and used car dealerships, sub-brokers, or individual commercial vehicle buyers. The broker negotiates aggregate credit lines (Registration Certificate Limits) from multiple lenders and redistributes this working capital to dealers for financing inventory or customer vehicle acquisitions.

Because vehicle loans remain uncollateralized until the updated Registration Certificate (RC) bearing the bank's hypothecation mark is issued by the Regional Transport Office (RTO), lenders enforce strict submission timeframes (typically 30–45 days). The broker assumes the compliance risk: if dealers accumulate past-due RCs, the bank freezes the broker's aggregate facility ("Stop-Supply").

> **Primary System Objective:** To provide Anna Finance with a centralized operational platform (**RCLimit**) that manages dual-ledger accounting (Bank-to-Broker liabilities vs. Broker-to-Customer assets), automates risk underwriting (CIBIL bureau pulls and Vahan RC checks), enforces dealer sub-limits and stop-supply guardrails, tracks granular disbursal line-item deductions (RTO, Insurance, Valuation, Foreclosure), executes multi-tiered sub-broker commission splits, and handles WhatsApp conversational lead intake—all running on a low-cost, serverless stack designed for multi-tenant SaaS scaling.

---

## 2. Multi-Repository Architecture Strategy

To enforce clean separation of concerns, independent build/deploy pipelines, and team autonomy, the **RCLimit** ecosystem is split into three decoupled repositories:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             RCLimit Repository Model                        │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ 1. Database Repository       │ 2. Web API Backend Repository│ 3. React UI   │
│    (rclimit-db)              │    (rclimit-backend-api)     │    Repo       │
│                              │                              │ (rclimit-ui)  │
│ • Database Schema DDL        │ • ASP.NET Core Solution      │ • React       │
│ • Migrations & Seeds         │ • Clean Architecture Modules │   Dashboard   │
│ • Neon Branching Scripts     │ • MassTransit Saga Engine    │ • Vite /      │
│ • DB Views & Functions       │ • Custom Identity Provider   │   Tailwind    │
└──────────────────────────────┴──────────────────────────────┴───────────────┤
                                      ▲                              ▲
                                      │                              │
                                      └────── REST API / JWTs ───────┘
```

### 2.1 Repository Breakdown & Responsibilities

1. **Database Repository (`rclimit-db`)**:
   - Contains raw SQL migrations, Schema DDL definitions (`system`, `auth`, `accounting`, `public`), seed data, database functions, and Neon PostgreSQL Copy-on-Write branching/provisioning scripts.
   - Managed independently from code migrations to ensure strict DBA governance, schema auditing, and point-in-time recovery testing.

2. **Backend API Repository (`rclimit-backend-api`)**:
   - Contains the complete ASP.NET Core .NET solution (`RCLimit.sln`) organized following Modular Monolith and Clean Architecture principles.
   - Houses the MassTransit Saga Orchestration engine, Entity Framework Core DbContexts, Custom In-House Identity Provider, and background processing workers.

3. **Frontend UI Repository (`rclimit-ui`)**:
   - Modern single-page application (SPA) built with React, TypeScript, Vite, and Tailwind CSS.
   - Communicates with `rclimit-backend-api` exclusively over HTTPS via JSON REST endpoints using short-lived JWT Bearer tokens and HTTP-only cookies.

---

## 3. Tech Stack & Architectural Decisions

| System Layer | Selected Technology | Rationale & Architectural Benefits |
| :--- | :--- | :--- |
| **Backend Database Repo** | Neon PostgreSQL (Serverless) (`rclimit-db`) | • $0/mo Free Tier scaling to usage-based.<br>• **Scale-to-Zero:** Auto-pauses compute when idle overnight.<br>• **Copy-on-Write Branching:** Instant <1s database clones for preview testing.<br>• Built-in PgBouncer pooling for high-concurrency API webhooks. |
| **Backend API Repo** | ASP.NET Core (.NET) (`rclimit-backend-api`) | • Enterprise-grade performance with EF Core (Npgsql).<br>• Asynchronous webhook execution for WhatsApp and verification APIs.<br>• Native LINQ queries and strong type safety for dual-ledger financial calculations.<br>• MassTransit Saga Orchestration for cross-module eventual consistency. |
| **Frontend UI Repo** | React + TypeScript + Vite (`rclimit-ui`) | • High-performance SPA with fast component rendering and state management.<br>• Tailwind CSS for responsive mobile and desktop dealer dashboard designs.<br>• Decoupled UI deployment via Vercel / Netlify / Cloudflare Pages. |
| **Identity & Auth Engine** | Custom ASP.NET Core IdP (Embedded Modular Monolith) | • **Zero Vendor Cost:** In-house Identity Provider running on Neon DB (`auth` schema).<br>• **Multi-Login Support:** Local Email/Password + Social OAuth (Google, Facebook, Instagram) + OIDC/SSO.<br>• **Extractable Architecture:** Designed following Modular Monolith principles for seamless future extraction into a microservice. |
| **Lead Capture Channel** | Meta WhatsApp Business API | • Automated conversational bot for collecting Vehicle Reg numbers and Identity parameters.<br>• Real-time integration with Vahan RTO and CIBIL API gateways. |
| **File & Proof Storage** | S3-Compatible Cloud Storage | • Cheap object storage for storing uploaded RTO smartcard proofs, advice vouchers, and KYC documents. |

---

## 4. End-to-End Business Lifecycle Flow

| Phase | Stage Name | Operational Actions | System & Financial Impact |
| :---: | :--- | :--- | :--- |
| **01** | **Intake & Underwriting** | Lead enters via WhatsApp bot or manual entry. System runs automated CIBIL bureau pull on borrower and Vahan RC check on vehicle (`GJ05BX6637`), screening blacklists, tax, and active hypothecation. | System evaluates risk profile against lender criteria and assigns loan-to-value (LTV) and rate markup. Lead tagged to sub-broker `partner_id` if referred. |
| **02** | **Bank Disbursal** | Broker routes approved file to chosen Bank pool (e.g., `FINANCED BY: Chola`). Bank approves gross `LOAN AMOUNT` and disburses funds to broker's account minus bank fees. | System logs entry in Bank-to-Broker Ledger (Liability owed to Bank @ Wholesale Bank Rate). |
| **03** | **Customer Disbursal** | System checks dealer's active RC aging and available sub-limit. Broker prepares advice voucher, calculating net `DISBURSEMENT AMT` after deducting line items (`RTO CHARGES`, `INSURANCE PAYMENT`, `CONVENIENCE FEES`, `APPROX FORECLOSURE`, `PAYMENT TO BROKER/SELLER`, `VALUATION FEES`). | System logs entry in Broker-to-Customer Ledger (Asset owed by Dealer @ Retail Rate). Sub-limit utilized. |
| **04** | **RC Aging Clock** | Funds released; 30/45-day RC submission countdown starts. Automated WhatsApp/SMS alerts triggered at days 15, 22, and 28. | Daily accrual of net interest spread ($\text{Customer Rate} - \text{Bank Rate}$) and commission tracking (`PAYOUT`, `BONUS PAYOUT`, `SHARED PAYOUT`). |
| **05** | **Document Upload & Verification** | Dealer uploads interim RTO acknowledgement slip or final updated RC smartcard. Broker ops team verifies proof against government databases. | Document status transitions to `RC_Submitted`. Verified RC pushed to Bank portal. |
| **06** | **Clearance & Unlocking** | Bank accepts RC submission. File marked fully compliant. Dealer's credit sub-limit headroom is restored. | Dealer's `pending_rc_count` decreases. Headroom unlocked for next vehicle loan. |

> **The Stop-Supply Trigger Rule:** If an active vehicle loan reaches its maximum SLA (e.g., 45 days) without an approved RC submission, the system automatically sets the dealer's `stop_supply_flag = TRUE`. This instantly locks all further loan disbursals to that dealer across all partner bank pools until the backlog is cleared.

---

## 5. Master Multi-Tenant PostgreSQL Schema DDL

The database is divided into four distinct PostgreSQL schemas inside Neon DB to ensure security, auditability, and clean domain isolation.

### 5.1 System Control Schema (`system` Schema)

```sql
CREATE SCHEMA IF NOT EXISTS system;

-- 1. Tenants (Brokers / DSAs using RCLimit)
CREATE TABLE system.tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_name VARCHAR(150) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    custom_domain VARCHAR(150) UNIQUE,
    subscription_plan VARCHAR(30) DEFAULT 'ENTERPRISE',
    is_active BOOLEAN DEFAULT TRUE,
    database_connection_string TEXT, -- Null for shared DB; populated if tenant has dedicated DB
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tenant Settings
CREATE TABLE system.tenant_settings (
    setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES system.tenants(tenant_id) ON DELETE CASCADE,
    max_active_dealers INT DEFAULT 50,
    allow_whatsapp_intake BOOLEAN DEFAULT TRUE,
    custom_vahan_api_key VARCHAR(255),
    custom_cibil_gateway_credentials JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Custom Identity & Multi-Login Schema (`auth` Schema)

```sql
CREATE SCHEMA IF NOT EXISTS auth;

-- 1. Master System Users
CREATE TABLE auth.users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL, -- Isolated by tenant
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    password_salt VARCHAR(255),
    full_name VARCHAR(150),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 2. External Social Identities (Google, Facebook, Instagram, OIDC)
CREATE TABLE auth.user_identities (
    identity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    identity_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_provider_user UNIQUE (provider_type, provider_user_id)
);
CREATE INDEX idx_user_identities_lookup ON auth.user_identities(provider_type, provider_user_id);

-- 3. Refresh Tokens (Session Token Management)
CREATE TABLE auth.refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 Audited Double-Entry Accounting Schema (`accounting` Schema)

```sql
CREATE SCHEMA IF NOT EXISTS accounting;

-- 1. Chart of Accounts (Audited & Mutable)
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

-- 2. Journal Entry Headers (Audited & Immutable)
CREATE TABLE accounting.journal_entries (
    journal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    entry_number SERIAL,
    entry_date DATE DEFAULT CURRENT_DATE,
    reference_id UUID NOT NULL, -- Links to loan_id, disbursal_line_item_id, or payout_id
    transaction_type VARCHAR(50) NOT NULL, -- 'BANK_DISBURSAL', 'CUSTOMER_DISBURSAL', 'FEE_DEDUCTION'
    narration TEXT NOT NULL,
    created_by_user_id UUID NOT NULL,
    posted_by_role VARCHAR(50) NOT NULL,
    source_module VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_journal_entries_reference ON accounting.journal_entries(reference_id);

-- 3. Ledger Line Items (Audited & Immutable)
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
```

### 5.4 Core Business Domain Schema (`public` Schema)

```sql
-- 1. Lenders (Banks & NBFCs)
CREATE TABLE lenders (
    lender_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    base_interest_rate DECIMAL(5,2) NOT NULL,
    default_tenure_limit_days INT NOT NULL DEFAULT 45,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- 2. Master Bank Pools
CREATE TABLE master_bank_pools (
    pool_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lender_id UUID REFERENCES lenders(lender_id),
    facility_account_number VARCHAR(50) NOT NULL,
    sanctioned_limit DECIMAL(15,2) NOT NULL,
    utilized_amount DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

-- 3. Customers (Dealers & Retail Buyers)
-- Note: user_id is a plain UUID without SQL foreign key to auth.users for extractability
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID, 
    customer_type VARCHAR(20) CHECK (customer_type IN ('DEALER', 'INDIVIDUAL')),
    legal_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    cibil_score INT,
    cibil_tier VARCHAR(10) CHECK (cibil_tier IN ('GREEN', 'AMBER', 'RED')),
    risk_status VARCHAR(30) DEFAULT 'ACTIVE'
);

-- 4. Customer Sub-Limits
CREATE TABLE customer_sub_limits (
    sub_limit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) ON DELETE CASCADE,
    assigned_ceiling DECIMAL(15,2) NOT NULL,
    current_utilization DECIMAL(15,2) DEFAULT 0.00,
    pending_rc_count INT DEFAULT 0,
    max_pending_rc_allowed INT DEFAULT 5,
    stop_supply_flag BOOLEAN DEFAULT FALSE
);

-- 5. Vehicles
CREATE TABLE vehicles (
    vehicle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    registration_number VARCHAR(20) NOT NULL,
    chassis_number VARCHAR(50),
    engine_number VARCHAR(50),
    make VARCHAR(50),
    model VARCHAR(50),
    year_of_mfg INT,
    current_rto_status VARCHAR(30) DEFAULT 'CLEAN'
);

-- 6. Partners (Sub-Brokers & Agents)
-- Note: user_id is a plain UUID without SQL foreign key to auth.users for extractability
CREATE TABLE partners (
    partner_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID,
    partner_type VARCHAR(30) CHECK (partner_type IN ('SUB_BROKER', 'DSA_AGENT')),
    legal_name VARCHAR(150) NOT NULL,
    default_commission_split_pct DECIMAL(5,2) DEFAULT 70.00,
    status VARCHAR(30) DEFAULT 'ACTIVE'
);

-- 7. Loan Transactions (Master Contract)
CREATE TABLE loan_transactions (
    loan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    serial_number SERIAL,
    lender_agreement_number VARCHAR(50),
    customer_id UUID REFERENCES customers(customer_id),
    vehicle_id UUID REFERENCES vehicles(vehicle_id),
    pool_id UUID REFERENCES master_bank_pools(pool_id),
    partner_id UUID REFERENCES partners(partner_id),
    product_type VARCHAR(30) DEFAULT 'USED_CV',
    sanctioned_amount DECIMAL(15,2) NOT NULL,
    net_disbursed_amount DECIMAL(15,2) NOT NULL,
    customer_rate DECIMAL(5,2) NOT NULL,
    bank_payout_pct_amt DECIMAL(10,2) DEFAULT 0.00,
    bonus_payout_amt DECIMAL(10,2) DEFAULT 0.00,
    shared_payout_amt DECIMAL(10,2) DEFAULT 0.00,
    total_payout_earned DECIMAL(10,2) GENERATED ALWAYS AS (bank_payout_pct_amt + bonus_payout_amt - shared_payout_amt) STORED,
    loan_status VARCHAR(30) DEFAULT 'DISBURSED_RC_PENDING',
    disbursal_date DATE DEFAULT CURRENT_DATE,
    remarks TEXT
);

-- 8. Disbursal Line Items (Line Deductions)
CREATE TABLE disbursal_line_items (
    line_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loan_transactions(loan_id) ON DELETE CASCADE,
    entry_date DATE DEFAULT CURRENT_DATE,
    particular_type VARCHAR(50) NOT NULL,
    mode_of_payment VARCHAR(20),
    bank_name VARCHAR(100),
    account_no VARCHAR(50),
    transaction_id VARCHAR(100),
    debit_amount DECIMAL(15,2) NOT NULL,
    running_balance_amt DECIMAL(15,2) NOT NULL
);

-- 9. Leads (Conversational Intake)
CREATE TABLE leads (
    lead_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    lead_source VARCHAR(30) DEFAULT 'WHATSAPP_BOT',
    partner_id UUID REFERENCES partners(partner_id),
    whatsapp_phone_number VARCHAR(20) NOT NULL,
    applicant_name VARCHAR(150),
    requested_loan_amount DECIMAL(15,2),
    vehicle_registration_number VARCHAR(20),
    vahan_validation_status VARCHAR(30) DEFAULT 'PENDING',
    cibil_score_preview INT,
    lead_status VARCHAR(30) DEFAULT 'INBOUND_INCOMPLETE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Master Broker Excel Mapping Matrix

| Broker Excel Field Label | Mapped System Entity | Database Attribute Name | Data Type & Business Purpose |
| :--- | :--- | :--- | :--- |
| **SR NO / S.NO** | `LoanTransaction` | `serial_number` | SERIAL / INT (Auto-indexed transaction order) |
| **CUSTOMER NAME / NAME** | `Customer` | `legal_name` | VARCHAR (e.g., "JIVA WASIM MEHMUD") |
| **FINANCE NAME / FINANCED BY** | `Lender` | `name` | VARCHAR (e.g., "CHOLA") |
| **LOAN AMOUNT** | `LoanTransaction` | `sanctioned_amount` | DECIMAL(15,2) (Gross loan sanction) |
| **PRODUCT / Sheet Header** | `LoanTransaction` | `product_type` | VARCHAR / ENUM (e.g., USED_CV) |
| **Reg No / REGIRSATION NO** | `Vehicle` | `registration_number` | VARCHAR (e.g., "GJ05BX6637") |
| **RATE** | `LoanTransaction` | `customer_rate` | DECIMAL(5,2) (Retail borrower rate) |
| **PAYOUT** | `LoanTransaction` | `bank_payout_pct_amt` | DECIMAL(10,2) (Base bank commission) |
| **BOUNS PAYOUT** | `LoanTransaction` | `bonus_payout_amt` | DECIMAL(10,2) (Volume incentive from bank) |
| **SHARED PAYOUT** | `LoanTransaction` | `shared_payout_amt` | DECIMAL(10,2) (Commission split to sub-agent) |
| **TOTAL PAYOUT EARN** | `LoanTransaction` | `total_payout_earned` | CALCULATED DECIMAL (`PAYOUT` + `BOUNS` - `SHARED`) |
| **STATUS** | `LoanTransaction` | `loan_status` | ENUM (`SANCTIONED`, `RC_PENDING`, `CLOSED`) |
| **REMARKS** | `LoanTransaction` | `remarks` | TEXT (Operational free-text notes) |
| **DISBURSEMENT AMT** | `LoanTransaction` | `net_disbursed_amount` | DECIMAL(15,2) (Net payout released to customer) |
| **AGREEMENT NO** | `LoanTransaction` | `lender_agreement_number` | VARCHAR (Lender agreement reference ID) |
| **DATE** | `LoanTransaction` / `DisbursalLineItem` | `disbursal_date` / `entry_date` | DATE (e.g., "28 March 2026") |
| **PARTICULAR** | `DisbursalLineItem` | `particular_type` | ENUM (Dropdown items: RTO, Insurance, Valuation, etc.) |
| **MODE OF PAYMENT** | `DisbursalLineItem` | `mode_of_payment` | ENUM (`NEFT`, `RTGS`, `CHEQUE`, `CASH`) |
| **BANK NAME** | `DisbursalLineItem` | `bank_name` | VARCHAR (Beneficiary/Remittance bank) |
| **ACCOUNT NO** | `DisbursalLineItem` | `account_no` | VARCHAR (Beneficiary account number) |
| **TRANSACTION ID** | `DisbursalLineItem` | `transaction_id` | VARCHAR (UTR / Banking transaction code) |
| **DEBIT AMT** | `DisbursalLineItem` | `debit_amount` | DECIMAL(15,2) (Line-item deduction amount) |
| **BALANCE AMT** | `DisbursalLineItem` | `running_balance_amt` | DECIMAL(15,2) (Remaining undisbursed balance) |

---

## 7. Modular Monolith Code Architecture (`RCLimit.sln`)

The backend codebase (`rclimit-backend-api`) follows Clean Architecture structured into isolated modules:

```text
RCLimit.sln
│
├── src/
│   ├── BuildingBlocks/
│   │   ├── RCLimit.BuildingBlocks.Contracts/        (ITenantContext, IntegrationEvents)
│   │   ├── RCLimit.BuildingBlocks.Domain/           (AggregateRoot, Entity, ValueObject, ITenantEntity)
│   │   └── RCLimit.BuildingBlocks.Infrastructure/   (SagaOrchestrator, OutboxPattern, TenantMiddleware)
│   │
│   ├── Modules/
│   │   ├── Identity/                                <-- Module 1: Custom IdP ('auth' schema)
│   │   │   ├── RCLimit.Modules.Identity.Domain/
│   │   │   ├── RCLimit.Modules.Identity.Application/
│   │   │   ├── RCLimit.Modules.Identity.Infrastructure/
│   │   │   └── RCLimit.Modules.Identity.Contracts/
│   │   │
│   │   ├── Accounting/                              <-- Module 2: Audited Double-Entry Ledger ('accounting' schema)
│   │   │   ├── RCLimit.Modules.Accounting.Domain/
│   │   │   ├── RCLimit.Modules.Accounting.Application/
│   │   │   ├── RCLimit.Modules.Accounting.Infrastructure/
│   │   │   └── RCLimit.Modules.Accounting.Contracts/
│   │   │
│   │   ├── Loans/                                   <-- Module 3: Core Loans & Sagas ('public' schema)
│   │   │   ├── RCLimit.Modules.Loans.Domain/
│   │   │   ├── RCLimit.Modules.Loans.Application/
│   │   │   ├── RCLimit.Modules.Loans.Infrastructure/
│   │   │   └── RCLimit.Modules.Loans.Contracts/
│   │   │
│   │   ├── Partners/                                <-- Module 4: Sub-Broker Commissions ('public' schema)
│   │   │   ├── RCLimit.Modules.Partners.Domain/
│   │   │   ├── RCLimit.Modules.Partners.Application/
│   │   │   ├── RCLimit.Modules.Partners.Infrastructure/
│   │   │   └── RCLimit.Modules.Partners.Contracts/
│   │   │
│   │   └── System/                                  <-- Module 5: Multi-Tenant SaaS Engine ('system' schema)
│   │       ├── RCLimit.Modules.System.Domain/
│   │       ├── RCLimit.Modules.System.Application/
│   │       └── RCLimit.Modules.System.Infrastructure/
│   │
│   └── WebApi/                                      <-- Main Web API Host Project
│       ├── RCLimit.WebApi/
│       ├── Program.cs
│       └── appsettings.json
│
└── tests/
    ├── RCLimit.ArchitectureTests/                  (Boundary enforcement tests)
    ├── RCLimit.Modules.Identity.Tests/
    ├── RCLimit.Modules.Accounting.Tests/
    └── RCLimit.Modules.Loans.Tests/
```

### 7.1 The 5 Extraction Safeguards

1. **Schema Isolation:** Identity (`auth`), Accounting (`accounting`), Loans (`public`), and Tenant Control (`system`) live in separate schemas inside Neon DB.
2. **No Cross-Boundary Foreign Keys:** Entities across module boundaries reference `user_id` or `partner_id` as plain UUID values without SQL foreign key constraints.
3. **Interface-Based Boundaries (`IIdentityModuleApi`, `IAccountingModuleApi`):** Modules communicate strictly through public interface contracts.
4. **Event-Driven Communication:** Cross-module updates publish asynchronous integration events via MassTransit.
5. **Stateless JWT Validation:** API nodes validate Bearer tokens in-memory without querying the identity database on business requests.

---

## 8. Saga Orchestration Engine (MassTransit)

For cross-module multi-step transactions (e.g., executing a loan disbursal across Loans, Accounting, and Partners), a Saga State Machine manages eventual consistency and compensating rollbacks:

```text
[Loans Module]                  [Accounting Module]                 [Partners Module]
      │                                   │                                   │
      ├─ 1. LoanDisbursalStarted ────────►│                                   │
      │                                   ├─ 2. Posts Journal Entries         │
      │ ◄─ 3. JournalPostingSucceeded ────┤                                   │
      │                                                                       │
      ├─ 4. CalculateCommission ─────────────────────────────────────────────►│
      │                                                                       ├─ 5. Payout Calculated
      │ ◄─ 6. CommissionSucceeded ────────────────────────────────────────────┤
      │
      └─ 7. Finalize Disbursal & Mark Compliant
```

If any step fails (e.g., sub-broker payout error), the Saga Orchestrator issues a compensating command (`CompensateJournalEntryPostingCommand`) to reverse previous ledger postings safely.

---

## 9. Hardened Identity Endpoint Taxonomy (`/api/v1/auth`)

The Identity module exposes 12 production-grade endpoints grouped into 5 capability clusters:

| Method | Endpoint Route | Request Payload / Params | Response & Security Behaviors |
| :---: | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | `{ "email", "password", "fullName", "phoneNumber" }` | Hashes password with Argon2id, persists user to `auth.users`, triggers `UserRegisteredEvent`. |
| **POST** | `/api/v1/auth/login` | `{ "email", "password" }` | Validates credentials, creates session, returns 15-min JWT Access Token + cryptographically hashed Refresh Token. |
| **POST** | `/api/v1/auth/refresh` | `{ "refreshToken" }` | **Token Rotation & Anti-Reuse Detection:** Revokes submitted token, generates new pair. If revoked token presented, invalidates all user tokens. |
| **GET** | `/api/v1/auth/external-login/{provider}` | Query: `provider` (google, facebook, instagram) | Issues ASP.NET Core `ChallengeResult` initiating PKCE OAuth authorization flow. |
| **GET** | `/api/v1/auth/external-callback` | OAuth Claims Callback | Parses sub/email, checks `auth.user_identities`, auto-links account or provisions new profile. |
| **POST** | `/api/v1/auth/logout` | `{ "refreshToken" }` (Bearer Auth) | Sets `is_revoked = TRUE` on target token row in `auth.refresh_tokens`. |
| **POST** | `/api/v1/auth/revoke-all` | (Bearer Auth) | Emergency security reset: revokes all active refresh tokens for user across all devices. |
| **GET** | `/api/v1/auth/sessions` | (Bearer Auth) | Returns list of active device sessions and token creation metadata. |
| **POST** | `/api/v1/auth/forgot-password` | `{ "email" }` | Generates short-lived password reset token sent via Email/SMS gateway. |
| **POST** | `/api/v1/auth/reset-password` | `{ "resetToken", "newPassword" }` | Validates reset token, updates `password_hash`, invalidates existing refresh sessions. |
| **POST** | `/api/v1/auth/change-password` | `{ "currentPassword", "newPassword" }` (Bearer Auth) | Verifies active password in authenticated context and updates hash. |
| **GET** | `/api/v1/auth/me` | (Bearer Auth) | Retrieves current authenticated profile, claims, assigned roles, and linked identity providers. |
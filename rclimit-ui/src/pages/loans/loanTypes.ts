// Shapes and labels shared by the loan screens.

export interface LoanListItem {
  loanId: string;
  applicationNumber: string;
  customerId?: string;
  customerName: string;
  vehicleRegNo: string;
  lenderName: string;
  productType: string;
  requestedAmount: number;
  sanctionedAmount: number | null;
  netDisbursedAmount: number;
  loanStatus: string;
  disbursalDate: string | null;
  rcAgingDays?: number | null;
  rcAgingStatus?: string | null;
}

export interface LoanTotals {
  requestedAmount: number;
  sanctionedAmount: number;
  netDisbursedAmount: number;
}

export interface LedgerEntryDto {
  lineItemId: string;
  entryDate: string;
  entryDirection: 'CREDIT' | 'DEBIT';
  counterparty: string;
  particularType: string;
  modeOfPayment: string | null;
  bankName: string | null;
  accountNo: string | null;
  transactionId: string | null;
  amount: number;
  runningBalanceAmt: number;
}

export interface LoanDetail {
  loanId: string;
  applicationNumber: string;
  lenderAgreementNumber: string | null;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleRegNo: string;
  lenderName: string;
  poolId: string;
  partnerId: string | null;
  productType: string;
  requestedAmount: number;
  sanctionedAmount: number | null;
  netDisbursedAmount: number;
  customerRate: number;
  tenureMonths: number | null;
  bankPayoutPctAmt: number;
  bonusPayoutAmt: number;
  sharedPayoutAmt: number;
  totalPayoutEarned: number;
  loanStatus: string;
  nextStatuses: string[];
  loggedInDate: string | null;
  sanctionDate: string | null;
  disbursalDate: string | null;
  emiStartDate: string | null;
  emiDueDay: number | null;
  pddDueDate: string | null;
  closedDate: string | null;
  rejectionWithdrawnDate: string | null;
  rejectionWithdrawnReason: string | null;
  remarks: string | null;
  rcStage: string | null;
  rcAgingStatus: string | null;
  rcAgingDays: number | null;
  postDisbursementDocumentStatusId: string | null;
  postDisbursementDocumentStatusLabel: string | null;
  ledgerEntries: LedgerEntryDto[];
}

export interface MasterOption {
  code: string;
  label: string;
  isActive: boolean;
}

export const PRODUCT_TYPES = [
  { value: 'USED_CV', label: 'Used CV' },
  { value: 'NEW_CV', label: 'New CV' },
  { value: 'REFINANCE', label: 'Refinance' },
];

export const LOAN_STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'DOCUMENTS_PENDING', label: 'Documents pending' },
  { value: 'LOGGED_IN', label: 'Logged in' },
  { value: 'CREDIT_REVIEW', label: 'Credit review' },
  { value: 'SANCTIONED', label: 'Sanctioned' },
  { value: 'DISBURSED', label: 'Disbursed' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

// Verb labels for stage moves (§13).
export const STAGE_ACTION_LABELS: Record<string, string> = {
  DOCUMENTS_PENDING: 'Mark documents pending',
  LOGGED_IN: 'Mark logged in',
  CREDIT_REVIEW: 'Move to credit review',
  SANCTIONED: 'Sanction',
  DISBURSED: 'Disburse',
  CLOSED: 'Close loan',
  REJECTED: 'Reject',
  WITHDRAWN: 'Withdraw',
};

export const STAGE_CONSEQUENCE: Record<string, string> = {
  DOCUMENTS_PENDING: 'The file waits for documents before it can be logged in.',
  LOGGED_IN: 'The file is recorded as logged in with the lender today.',
  CREDIT_REVIEW: "The lender's credit team reviews the file next.",
  CLOSED: 'A closed loan takes no more ledger entries.',
};

// The forward path shown in the workflow stepper (§10.8).
export const WORKFLOW_STEPS = ['DOCUMENTS_PENDING', 'LOGGED_IN', 'CREDIT_REVIEW', 'SANCTIONED', 'DISBURSED', 'CLOSED'] as const;

export const PAYMENT_MODES = [
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'IMPS', label: 'IMPS' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal transfer' },
];

export const RC_AGING_OPTIONS = [
  { value: 'ON_TIME', label: 'On time' },
  { value: 'WARNING_ZONE', label: 'Warning' },
  { value: 'OVERDUE_LOCK', label: 'Overdue' },
];

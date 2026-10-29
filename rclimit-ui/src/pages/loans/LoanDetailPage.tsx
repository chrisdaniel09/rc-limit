import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';
import { apiPatch, apiPost } from '../../api/client';
import Badge from '../../components/Badge';
import { statusVariant } from '../../components/badgeVariants';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface LedgerEntry {
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

interface DocumentStatus {
  documentStatusId: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

interface Counterparty {
  optionId: string;
  code: string;
  label: string;
  isActive: boolean;
}

interface ParticularType {
  particularTypeId: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

interface LoanDetail {
  loanId: string;
  applicationNumber: string;
  lenderAgreementNumber: string | null;
  customerName: string;
  vehicleRegNo: string;
  lenderName: string;
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
  ledgerEntries: LedgerEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  DOCUMENTS_PENDING: 'Mark documents pending',
  LOGGED_IN: 'Mark logged in',
  CREDIT_REVIEW: 'Move to credit review',
  SANCTIONED: 'Sanction',
  DISBURSED: 'Disburse',
  CLOSED: 'Close loan',
  REJECTED: 'Reject',
  WITHDRAWN: 'Withdraw',
};

const paymentModes = [
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer' },
];

const today = () => new Date().toISOString().slice(0, 10);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

const emptyEntry = { entryDirection: 'CREDIT', counterparty: 'ANNA_FINANCE', particularType: '', modeOfPayment: '', bankName: '', accountNo: '', transactionId: '', amount: '' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-gray-500">{label}</span>
      <div className="font-medium text-gray-900">{children}</div>
    </div>
  );
}

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRight } = useAuth();
  const canEdit = hasRight('loans.edit');
  const { data: loan, loading, refetch } = useFetch<LoanDetail>(`/api/v1/loans/${id}`, [id]);
  const { data: particularTypes } = useFetch<ParticularType[]>('/api/v1/particular-types');
  const { data: counterparties } = useFetch<Counterparty[]>('/api/v1/lender-disbursed-to-options');
  const { data: documentStatuses } = useFetch<DocumentStatus[]>('/api/v1/document-statuses');

  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [updatingDocumentStatus, setUpdatingDocumentStatus] = useState(false);

  // One dialog at a time: the ledger entry, sanction, disburse, or a reason for reject/withdraw.
  const [dialog, setDialog] = useState<null | 'entry' | 'sanction' | 'disburse' | 'reason'>(null);
  const [reasonTarget, setReasonTarget] = useState<string>('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [entry, setEntry] = useState(emptyEntry);
  const [sanction, setSanction] = useState({ sanctionedAmount: '', tenureMonths: '', customerRate: '', sanctionDate: today() });
  const [disburse, setDisburse] = useState({ disbursalDate: today(), emiStartDate: '', emiDueDay: '' });
  const [reason, setReason] = useState('');

  const reload = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openDialog = (kind: 'entry' | 'sanction' | 'disburse' | 'reason') => {
    setDialogError(null);
    setDialog(kind);
  };

  // Runs a dialog's request, closes the dialog on success and shows the server's reason on failure.
  const submitDialog = async (request: () => Promise<unknown>, fallback: string) => {
    setSubmitting(true);
    setDialogError(null);
    try {
      await request();
      setDialog(null);
      await reload();
    } catch (err) {
      setDialogError(errorMessage(err, fallback));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStageAction = async (target: string) => {
    if (target === 'SANCTIONED') {
      setSanction({ sanctionedAmount: loan ? String(loan.requestedAmount) : '', tenureMonths: '', customerRate: '', sanctionDate: today() });
      openDialog('sanction');
      return;
    }
    if (target === 'DISBURSED') {
      setDisburse({ disbursalDate: today(), emiStartDate: '', emiDueDay: '' });
      openDialog('disburse');
      return;
    }
    if (target === 'REJECTED' || target === 'WITHDRAWN') {
      setReasonTarget(target);
      setReason('');
      openDialog('reason');
      return;
    }
    if (!window.confirm(`${ACTION_LABELS[target] ?? target}?`)) return;
    setPageError(null);
    try {
      await apiPost(`/api/v1/loans/${id}/status`, { targetStatus: target, reason: null });
      await reload();
    } catch (err) {
      setPageError(errorMessage(err, 'Failed to change the loan status.'));
    }
  };

  const handleUpdateDocumentStatus = async (statusId: string | null) => {
    setUpdatingDocumentStatus(true);
    setPageError(null);
    try {
      await apiPatch(`/api/v1/loans/${id}/document-status`, { documentStatusId: statusId || null });
      await reload();
    } catch (err) {
      setPageError(errorMessage(err, 'Failed to update the document status.'));
    } finally {
      setUpdatingDocumentStatus(false);
    }
  };

  if (loading || !loan) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white rounded-lg animate-pulse border border-gray-200" />)}</div>;
  }

  const isDisbursed = loan.loanStatus === 'DISBURSED';
  const balance = loan.netDisbursedAmount;

  // Lender Disbursed Amount is derived from the credits to Anna Finance (R5). It is compared with the sanction.
  const lenderDisbursed = loan.ledgerEntries
    .filter((e) => e.entryDirection === 'CREDIT' && e.counterparty === 'ANNA_FINANCE')
    .reduce((sum, e) => sum + e.amount, 0);
  const lenderDisbursedDiffers = loan.sanctionedAmount != null && lenderDisbursed > 0 && lenderDisbursed !== loan.sanctionedAmount;

  const activeCounterparties = (counterparties ?? []).filter((c) => c.isActive);
  const entryAmount = parseFloat(entry.amount);
  const debitExceedsBalance = entry.entryDirection === 'DEBIT' && entryAmount > balance;

  return (
    <div className="space-y-6">
      {/* Loan Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Loan {loan.applicationNumber}</h2>
            <Badge text={loan.loanStatus} variant={statusVariant(loan.loanStatus)} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && loan.nextStatuses.map((target) => (
              <button
                key={target}
                onClick={() => handleStageAction(target)}
                className={
                  target === 'REJECTED' || target === 'WITHDRAWN'
                    ? 'rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50'
                    : 'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700'
                }
              >
                {ACTION_LABELS[target] ?? target}
              </button>
            ))}
            <button
              onClick={reload}
              disabled={refreshing}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Refresh loan data"
            >
              {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {pageError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</p>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Customer">{loan.customerName}</Field>
          <Field label="Vehicle">{loan.vehicleRegNo}</Field>
          <Field label="Lender">{loan.lenderName}</Field>
          <Field label="Agreement #">{loan.lenderAgreementNumber || '-'}</Field>
          <Field label="Product">{loan.productType.replace(/_/g, ' ')}</Field>
          <Field label="Requested">{formatCurrency(loan.requestedAmount)}</Field>
          <Field label="Sanctioned">
            <span className="text-green-700">{loan.sanctionedAmount == null ? 'Not sanctioned' : formatCurrency(loan.sanctionedAmount)}</span>
          </Field>
          <Field label="Tenure / Rate">
            {loan.tenureMonths ? `${loan.tenureMonths} months` : '-'} · {loan.customerRate}%
          </Field>
          <Field label="Anna Finance Balance">
            <span className="text-blue-700">{formatCurrency(balance)}</span>
          </Field>
          <Field label="Lender Disbursed (from credits)">
            <span className={lenderDisbursedDiffers ? 'text-amber-700' : ''}>{formatCurrency(lenderDisbursed)}</span>
            {lenderDisbursedDiffers && <p className="text-xs font-normal text-amber-700">Differs from the sanctioned amount</p>}
          </Field>
          <Field label="Sanction Date">{formatDate(loan.sanctionDate)}</Field>
          <Field label="Disbursal Date">{formatDate(loan.disbursalDate)}</Field>
          <Field label="EMI">
            {loan.emiStartDate ? `From ${formatDate(loan.emiStartDate)}, day ${loan.emiDueDay}` : '-'}
          </Field>
          <Field label="PDD Due">{formatDate(loan.pddDueDate)}</Field>
          <Field label="RC Stage"><Badge text={loan.rcStage || 'N/A'} variant={statusVariant(loan.rcStage ?? '')} /></Field>
          <Field label="RC Aging">{loan.rcAgingDays !== null ? `${loan.rcAgingDays} days` : 'N/A'}</Field>
          {isDisbursed && (
            <div>
              <span className="text-gray-500">Post Disbursement Doc</span>
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={loan.postDisbursementDocumentStatusId || ''}
                  onChange={(e) => handleUpdateDocumentStatus(e.target.value || null)}
                  disabled={updatingDocumentStatus || !canEdit}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 bg-white hover:border-gray-400 disabled:opacity-50"
                >
                  <option value="">Select Status</option>
                  {documentStatuses?.filter((ds) => ds.isActive).map((ds) => (
                    <option key={ds.documentStatusId} value={ds.documentStatusId}>{ds.label}</option>
                  ))}
                </select>
                {updatingDocumentStatus && <span className="text-xs text-gray-400">Updating...</span>}
              </div>
            </div>
          )}
          {loan.rejectionWithdrawnReason && (
            <div className="col-span-2 md:col-span-4">
              <span className="text-gray-500">{loan.loanStatus === 'REJECTED' ? 'Rejected' : 'Withdrawn'} on {formatDate(loan.rejectionWithdrawnDate)}</span>
              <p className="text-gray-700">{loan.rejectionWithdrawnReason}</p>
            </div>
          )}
          {loan.remarks && <div className="col-span-2 md:col-span-4"><span className="text-gray-500">Remarks</span><p className="text-gray-700">{loan.remarks}</p></div>}
        </div>
      </div>

      {/* Payout Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-md font-semibold text-gray-900 mb-3">Payout Breakdown</h3>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="bg-green-50 border border-green-200 rounded-md px-4 py-2">
            <span className="text-green-600">Payout</span>
            <p className="font-semibold text-green-800">{formatCurrency(loan.bankPayoutPctAmt)}</p>
          </div>
          <span className="text-gray-400 text-lg">+</span>
          <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
            <span className="text-blue-600">Bonus</span>
            <p className="font-semibold text-blue-800">{formatCurrency(loan.bonusPayoutAmt)}</p>
          </div>
          <span className="text-gray-400 text-lg">-</span>
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2">
            <span className="text-red-600">Shared</span>
            <p className="font-semibold text-red-800">{formatCurrency(loan.sharedPayoutAmt)}</p>
          </div>
          <span className="text-gray-400 text-lg">=</span>
          <div className="bg-indigo-50 border border-indigo-200 rounded-md px-4 py-2">
            <span className="text-indigo-600">Total Earned</span>
            <p className="font-semibold text-indigo-800">{formatCurrency(loan.totalPayoutEarned)}</p>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Ledger</h3>
          {isDisbursed && canEdit ? (
            <button
              onClick={() => { setEntry(emptyEntry); openDialog('entry'); }}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              Add Entry
            </button>
          ) : (
            !isDisbursed && <span className="text-xs text-gray-400">Ledger entries can be added once the loan is disbursed.</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Counterparty</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Particular</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Txn ID</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loan.ledgerEntries.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-500">No ledger entries</td></tr>
              ) : (
                loan.ledgerEntries.map((item) => (
                  <tr key={item.lineItemId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(item.entryDate)}</td>
                    <td className="px-3 py-2 text-sm"><Badge text={item.entryDirection} variant={item.entryDirection === 'CREDIT' ? 'success' : 'neutral'} /></td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.counterparty.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.particularType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.modeOfPayment || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.bankName || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.transactionId || '-'}</td>
                    <td className="px-3 py-2 text-sm text-green-700 text-right font-medium">{item.entryDirection === 'CREDIT' ? formatCurrency(item.amount) : ''}</td>
                    <td className="px-3 py-2 text-sm text-red-600 text-right font-medium">{item.entryDirection === 'DEBIT' ? formatCurrency(item.amount) : ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.runningBalanceAmt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add ledger entry */}
      <Modal isOpen={dialog === 'entry'} onClose={() => setDialog(null)} title="Add Ledger Entry">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDialog(() => apiPost(`/api/v1/loans/${id}/line-items`, {
              entryDirection: entry.entryDirection,
              counterparty: entry.counterparty,
              particularType: entry.entryDirection === 'DEBIT' ? entry.particularType : null,
              modeOfPayment: entry.modeOfPayment || null,
              bankName: entry.bankName || null,
              accountNo: entry.accountNo || null,
              transactionId: entry.transactionId || null,
              amount: entryAmount,
            }), 'Failed to add the ledger entry.');
          }}
        >
          <FormField
            label="Entry Type"
            value={entry.entryDirection}
            onChange={(v) => setEntry({ ...entry, entryDirection: v, particularType: '' })}
            required
            options={[{ value: 'CREDIT', label: 'Credit (bank pays out)' }, { value: 'DEBIT', label: 'Debit (paid from the Anna Finance balance)' }]}
          />
          <FormField
            label={entry.entryDirection === 'CREDIT' ? 'Recipient' : 'Payee'}
            value={entry.counterparty}
            onChange={(v) => setEntry({ ...entry, counterparty: v })}
            required
            options={activeCounterparties.map((c) => ({ value: c.code, label: c.label }))}
          />
          {entry.entryDirection === 'CREDIT' && entry.counterparty === 'CUSTOMER' && (
            <p className="-mt-2 mb-3 text-xs text-gray-500">A credit straight to the customer is recorded but does not change the Anna Finance balance.</p>
          )}
          {entry.entryDirection === 'DEBIT' && (
            <FormField label="Particular Type" value={entry.particularType} onChange={(v) => setEntry({ ...entry, particularType: v })} required options={
              (particularTypes ?? []).filter((t) => t.isActive).map((t) => ({ value: t.code, label: t.label }))
            } />
          )}
          <FormField label="Mode of Payment" value={entry.modeOfPayment} onChange={(v) => setEntry({ ...entry, modeOfPayment: v })} options={paymentModes} />
          <FormField label="Bank Name" value={entry.bankName} onChange={(v) => setEntry({ ...entry, bankName: v })} />
          <FormField label="Account No" value={entry.accountNo} onChange={(v) => setEntry({ ...entry, accountNo: v })} />
          <FormField label="Transaction ID" value={entry.transactionId} onChange={(v) => setEntry({ ...entry, transactionId: v })} />
          <FormField label="Amount (₹)" type="number" value={entry.amount} onChange={(v) => setEntry({ ...entry, amount: v })} required />
          <p className={`text-xs ${debitExceedsBalance ? 'text-red-600' : 'text-gray-500'}`}>
            Anna Finance balance: {formatCurrency(balance)}{debitExceedsBalance ? ' — this debit is larger than the balance.' : ''}
          </p>
          {dialogError && <p className="mt-3 text-sm text-red-600">{dialogError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting || debitExceedsBalance} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Adding...' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Sanction */}
      <Modal isOpen={dialog === 'sanction'} onClose={() => setDialog(null)} title="Sanction Loan">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDialog(() => apiPost(`/api/v1/loans/${id}/sanction`, {
              sanctionedAmount: parseFloat(sanction.sanctionedAmount),
              tenureMonths: parseInt(sanction.tenureMonths, 10),
              customerRate: parseFloat(sanction.customerRate),
              sanctionDate: sanction.sanctionDate,
            }), 'Failed to sanction the loan.');
          }}
        >
          <FormField label="Sanctioned Amount (₹)" type="number" value={sanction.sanctionedAmount} onChange={(v) => setSanction({ ...sanction, sanctionedAmount: v })} required />
          <FormField label="Tenure (months)" type="number" value={sanction.tenureMonths} onChange={(v) => setSanction({ ...sanction, tenureMonths: v })} required />
          <FormField label="Customer Rate (%)" type="number" value={sanction.customerRate} onChange={(v) => setSanction({ ...sanction, customerRate: v })} required />
          <FormField label="Sanction Date" type="date" value={sanction.sanctionDate} onChange={(v) => setSanction({ ...sanction, sanctionDate: v })} required />
          <p className="text-xs text-gray-500">For Used CV, the amount is checked against the customer's sub-limit.</p>
          {dialogError && <p className="mt-3 text-sm text-red-600">{dialogError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Sanction'}</button>
          </div>
        </form>
      </Modal>

      {/* Disburse */}
      <Modal isOpen={dialog === 'disburse'} onClose={() => setDialog(null)} title="Disburse Loan">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDialog(() => apiPost(`/api/v1/loans/${id}/disburse`, {
              disbursalDate: disburse.disbursalDate,
              emiStartDate: disburse.emiStartDate,
              emiDueDay: parseInt(disburse.emiDueDay, 10),
            }), 'Failed to disburse the loan.');
          }}
        >
          <FormField label="Disbursal Date" type="date" value={disburse.disbursalDate} onChange={(v) => setDisburse({ ...disburse, disbursalDate: v })} required />
          <FormField label="EMI Start Date" type="date" value={disburse.emiStartDate} onChange={(v) => setDisburse({ ...disburse, emiStartDate: v })} required />
          <FormField label="EMI Due Day (1-31)" type="number" value={disburse.emiDueDay} onChange={(v) => setDisburse({ ...disburse, emiDueDay: v })} required />
          <p className="text-xs text-gray-500">Disbursal records the status only. Add the bank's credit as a ledger entry afterwards.</p>
          {dialogError && <p className="mt-3 text-sm text-red-600">{dialogError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Disburse'}</button>
          </div>
        </form>
      </Modal>

      {/* Reject or withdraw */}
      <Modal isOpen={dialog === 'reason'} onClose={() => setDialog(null)} title={reasonTarget === 'REJECTED' ? 'Reject Loan' : 'Withdraw Loan'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitDialog(() => apiPost(`/api/v1/loans/${id}/status`, { targetStatus: reasonTarget, reason }), 'Failed to change the loan status.');
          }}
        >
          <FormField label="Reason" value={reason} onChange={setReason} required />
          {dialogError && <p className="mt-3 text-sm text-red-600">{dialogError}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setDialog(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{submitting ? 'Saving...' : ACTION_LABELS[reasonTarget]}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

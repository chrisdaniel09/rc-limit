import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface LineItem {
  lineItemId: string;
  entryDate: string;
  particularType: string;
  modeOfPayment: string;
  bankName: string;
  accountNo: string;
  transactionId: string;
  debitAmount: number;
  runningBalanceAmt: number;
}

interface LoanDetail {
  loanId: string;
  serialNumber: number;
  loanNumber: string;
  lenderAgreementNumber: string;
  customerName: string;
  vehicleReg: string;
  lenderName: string;
  productType: string;
  sanctionedAmount: number;
  lenderDisbursedAmount: number;
  lenderDisbursedTo: string;
  netDisbursedAmount: number;
  customerRate: number;
  bankPayoutPctAmt: number;
  bonusPayoutAmt: number;
  sharedPayoutAmt: number;
  totalPayoutEarned: number;
  loanStatus: string;
  disbursalDate: string;
  remarks: string;
  rcStage: string;
  rcAgingStatus: string;
  isDisbursalLineItemsEnabled: boolean;
  lineItems: LineItem[];
}


const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface ParticularType {
  particularTypeId: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

const paymentModes = [
  { value: 'NEFT', label: 'NEFT' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'INTERNAL_TRANSFER', label: 'Internal Transfer' },
];

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: loan, links, loading, refetch } = useFetch<LoanDetail>(`/api/v1/loans/${id}`, [id]);
  const { data: particularTypes } = useFetch<ParticularType[]>('/api/v1/particular-types');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ particularType: '', modeOfPayment: '', bankName: '', accountNo: '', transactionId: '', debitAmount: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost(`/api/v1/loans/${id}/line-items`, {
        particularType: form.particularType,
        modeOfPayment: form.modeOfPayment,
        bankName: form.bankName,
        accountNo: form.accountNo,
        transactionId: form.transactionId,
        debitAmount: parseFloat(form.debitAmount),
      });
      setShowModal(false);
      setForm({ particularType: '', modeOfPayment: '', bankName: '', accountNo: '', transactionId: '', debitAmount: '' });
      refetch();
    } catch {
      // handle
    } finally {
      setSubmitting(false);
    }
  };

  const hasLink = (rel: string) => links.some((l) => l.rel === rel);

  const isDisbursalEnabled = loan?.isDisbursalLineItemsEnabled ?? false;

  if (loading || !loan) {
    return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white rounded-lg animate-pulse border border-gray-200" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Loan Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Loan {loan.loanNumber || `#${loan.serialNumber}`}</h2>
          <div className="flex items-center gap-2">
            {hasLink('upload-rc-proof') && (
              <button className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
                Upload RC Proof
              </button>
            )}
            <Badge text={loan.loanStatus} variant={statusVariant(loan.loanStatus)} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Customer</span><p className="font-medium text-gray-900">{loan.customerName}</p></div>
          <div><span className="text-gray-500">Vehicle</span><p className="font-medium text-gray-900">{loan.vehicleReg}</p></div>
          <div><span className="text-gray-500">Lender</span><p className="font-medium text-gray-900">{loan.lenderName}</p></div>
          <div><span className="text-gray-500">Agreement #</span><p className="font-medium text-gray-900">{loan.lenderAgreementNumber || '-'}</p></div>
          <div><span className="text-gray-500">Product</span><p className="font-medium text-gray-900">{loan.productType}</p></div>
          <div><span className="text-gray-500">Sanctioned</span><p className="font-medium text-green-700">{formatCurrency(loan.sanctionedAmount)}</p></div>
          <div><span className="text-gray-500">Lender Disbursed Amt</span><p className="font-medium text-green-700">{formatCurrency(loan.lenderDisbursedAmount)}</p></div>
          <div><span className="text-gray-500">Lender Disbursed To</span><p className="font-medium text-gray-900">{loan.lenderDisbursedTo?.replace(/_/g, ' ') || '-'}</p></div>
          <div><span className="text-gray-500">Net Disbursed</span><p className="font-medium text-blue-700">{formatCurrency(loan.netDisbursedAmount)}</p></div>
          <div><span className="text-gray-500">Disbursal Date</span><p className="font-medium text-gray-900">{formatDate(loan.disbursalDate)}</p></div>
          <div><span className="text-gray-500">Customer Rate</span><p className="font-medium text-gray-900">{loan.customerRate}%</p></div>
          <div><span className="text-gray-500">RC Stage</span><p><Badge text={loan.rcStage || 'N/A'} variant={statusVariant(loan.rcStage)} /></p></div>
          <div><span className="text-gray-500">RC Aging</span><p><Badge text={loan.rcAgingStatus || 'N/A'} variant={statusVariant(loan.rcAgingStatus)} /></p></div>
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

      {/* Disbursal Line Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-semibold text-gray-900">Disbursal Line Items</h3>
          {isDisbursalEnabled ? (
            <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              Add Line Item
            </button>
          ) : (
            <span className="text-xs text-gray-400">Disbursal line items not enabled for this lender option</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Particular</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bank</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account #</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Txn ID</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loan.lineItems.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-500">No line items</td></tr>
              ) : (
                loan.lineItems.map((item) => (
                  <tr key={item.lineItemId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(item.entryDate)}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.particularType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.modeOfPayment || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.bankName || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.accountNo || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.transactionId || '-'}</td>
                    <td className="px-3 py-2 text-sm text-red-600 text-right font-medium">{formatCurrency(item.debitAmount)}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(item.runningBalanceAmt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Disbursal Line Item">
        <form onSubmit={handleAddLineItem}>
          <FormField label="Particular Type" value={form.particularType} onChange={(v) => setForm({ ...form, particularType: v })} required options={
            (particularTypes ?? []).filter(t => t.isActive).map(t => ({ value: t.code, label: t.label }))
          } />
          <FormField label="Mode of Payment" value={form.modeOfPayment} onChange={(v) => setForm({ ...form, modeOfPayment: v })} options={paymentModes} />
          <FormField label="Bank Name" value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
          <FormField label="Account No" value={form.accountNo} onChange={(v) => setForm({ ...form, accountNo: v })} />
          <FormField label="Transaction ID" value={form.transactionId} onChange={(v) => setForm({ ...form, transactionId: v })} />
          <FormField label="Debit Amount (₹)" type="number" value={form.debitAmount} onChange={(v) => setForm({ ...form, debitAmount: v })} required />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Adding...' : 'Add'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface Loan {
  loanId: string;
  serialNumber: number;
  loanNumber: string;
  customerName: string;
  vehicleReg: string;
  lenderName: string;
  sanctionedAmount: number;
  netDisbursedAmount: number;
  loanStatus: string;
  disbursalDate: string;
}

interface SelectItem { value: string; label: string }

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LoansPage() {
  const { data, loading, refetch } = useFetch<Loan[]>('/api/v1/loans');
  const { data: customers } = useFetch<{ customerId: string; legalName: string }[]>('/api/v1/customers');
  const { data: vehicles } = useFetch<{ vehicleId: string; registrationNumber: string }[]>('/api/v1/vehicles');
  const { data: bankPools } = useFetch<{ poolId: string; lenderId: string; lenderName: string; facilityAccountNumber: string; sanctionedLimit: number; utilizedAmount: number }[]>('/api/v1/bank-pools');
  const { data: partners } = useFetch<{ partnerId: string; legalName: string }[]>('/api/v1/partners');
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const { data: lenderDisbursedToOptions } = useFetch<{ optionId: string; code: string; label: string; sortOrder: number; isActive: boolean }[]>('/api/v1/lender-disbursed-to-options');
  const [form, setForm] = useState({
    customerId: '', vehicleId: '', poolId: '', partnerId: '',
    productType: 'USED_CV', lenderAgreementNumber: '',
    sanctionedAmount: '', lenderDisbursedAmount: '', lenderDisbursedTo: '',
    customerRate: '',
    bankPayoutPctAmt: '0', bonusPayoutAmt: '0', sharedPayoutAmt: '0', remarks: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Loan>[] = [
    { key: 'serialNumber', header: '#' },
    { key: 'customerName', header: 'Customer' },
    { key: 'vehicleReg', header: 'Vehicle Reg' },
    { key: 'lenderName', header: 'Lender' },
    { key: 'sanctionedAmount', header: 'Sanctioned', render: (l) => formatCurrency(l.sanctionedAmount) },
    { key: 'netDisbursedAmount', header: 'Disbursed', render: (l) => formatCurrency(l.netDisbursedAmount) },
    { key: 'loanStatus', header: 'Status', render: (l) => <Badge text={l.loanStatus} variant={statusVariant(l.loanStatus)} /> },
    { key: 'disbursalDate', header: 'Date', render: (l) => formatDate(l.disbursalDate) },
  ];

  const toOptions = (items: SelectItem[] | null): { value: string; label: string }[] =>
    items?.map((i) => ({ value: i.value, label: i.label })) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/loans', {
        customerId: form.customerId,
        vehicleId: form.vehicleId,
        poolId: form.poolId,
        partnerId: form.partnerId || null,
        lenderAgreementNumber: form.lenderAgreementNumber || null,
        productType: form.productType,
        sanctionedAmount: parseFloat(form.sanctionedAmount),
        lenderDisbursedAmount: parseFloat(form.lenderDisbursedAmount),
        lenderDisbursedTo: form.lenderDisbursedTo,
        customerRate: parseFloat(form.customerRate),
        bankPayoutPctAmt: parseFloat(form.bankPayoutPctAmt),
        bonusPayoutAmt: parseFloat(form.bonusPayoutAmt),
        sharedPayoutAmt: parseFloat(form.sharedPayoutAmt),
        remarks: form.remarks,
      });
      setShowModal(false);
      refetch();
    } catch {
      // handle
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">All Loans</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Create Loan
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        onRowClick={(loan) => navigate(`/loans/${loan.loanId}`)}
        searchPlaceholder="Search loans..."
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Loan">
        <form onSubmit={handleSubmit}>
          <FormField label="Customer" value={form.customerId} onChange={(v) => setForm({ ...form, customerId: v })} required options={toOptions(customers?.map((c) => ({ value: c.customerId, label: c.legalName })) ?? null)} />
          <FormField label="Vehicle" value={form.vehicleId} onChange={(v) => setForm({ ...form, vehicleId: v })} required options={toOptions(vehicles?.map((v) => ({ value: v.vehicleId, label: v.registrationNumber })) ?? null)} />
          <FormField label="Bank Pool (Lender Facility)" value={form.poolId} onChange={(v) => setForm({ ...form, poolId: v })} required options={toOptions(bankPools?.map((p) => ({ value: p.poolId, label: `${p.lenderName} — ${p.facilityAccountNumber}` })) ?? null)} />
          <FormField label="Product Type" value={form.productType} onChange={(v) => setForm({ ...form, productType: v })} required options={[{ value: 'USED_CV', label: 'Used CV' }, { value: 'NEW_CV', label: 'New CV' }, { value: 'REFINANCE', label: 'Refinance' }, { value: 'USED_CAR', label: 'Used Car' }]} />
          <FormField label="Lender Agreement No." value={form.lenderAgreementNumber} onChange={(v) => setForm({ ...form, lenderAgreementNumber: v })} />
          <FormField label="Partner (optional)" value={form.partnerId} onChange={(v) => setForm({ ...form, partnerId: v })} options={toOptions(partners?.map((p) => ({ value: p.partnerId, label: p.legalName })) ?? null)} />
          <FormField label="Sanctioned Amount (₹)" type="number" value={form.sanctionedAmount} onChange={(v) => setForm({ ...form, sanctionedAmount: v })} required />
          <FormField label="Lender Disbursed Amount (₹)" type="number" value={form.lenderDisbursedAmount} onChange={(v) => setForm({ ...form, lenderDisbursedAmount: v })} required />
          <FormField label="Lender Disbursed To" value={form.lenderDisbursedTo} onChange={(v) => setForm({ ...form, lenderDisbursedTo: v })} required options={
            (lenderDisbursedToOptions ?? []).filter(o => o.isActive).map(o => ({ value: o.code, label: o.label }))
          } />
          <FormField label="Customer Rate (%)" type="number" value={form.customerRate} onChange={(v) => setForm({ ...form, customerRate: v })} required />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Payout" type="number" value={form.bankPayoutPctAmt} onChange={(v) => setForm({ ...form, bankPayoutPctAmt: v })} />
            <FormField label="Bonus" type="number" value={form.bonusPayoutAmt} onChange={(v) => setForm({ ...form, bonusPayoutAmt: v })} />
            <FormField label="Shared" type="number" value={form.sharedPayoutAmt} onChange={(v) => setForm({ ...form, sharedPayoutAmt: v })} />
          </div>
          <FormField label="Remarks" value={form.remarks} onChange={(v) => setForm({ ...form, remarks: v })} />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

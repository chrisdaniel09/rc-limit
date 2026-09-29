import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface Customer {
  customerId: string;
  legalName: string;
  tradeName: string;
  customerType: string;
  cibilScore: number | null;
  cibilTier: string;
  riskStatus: string;
  assignedCeiling: number;
  currentUtilization: number;
  stopSupplyFlag: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function CustomersPage() {
  const { data, loading, refetch } = useFetch<Customer[]>('/api/v1/customers');
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ legalName: '', tradeName: '', customerType: 'DEALER', phoneNumber: '', assignedCeiling: '' });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Customer>[] = [
    { key: 'legalName', header: 'Legal Name' },
    { key: 'tradeName', header: 'Trade Name' },
    { key: 'customerType', header: 'Type', render: (c) => <Badge text={c.customerType} variant="neutral" /> },
    { key: 'cibilScore', header: 'CIBIL', render: (c) => c.cibilScore ?? '-' },
    { key: 'cibilTier', header: 'Tier', render: (c) => c.cibilTier ? <Badge text={c.cibilTier} variant={statusVariant(c.cibilTier)} /> : '-' },
    { key: 'riskStatus', header: 'Risk', render: (c) => <Badge text={c.riskStatus} variant={statusVariant(c.riskStatus)} /> },
    {
      key: 'utilization',
      header: 'Sub-Limit',
      render: (c) => {
        const pct = c.assignedCeiling > 0 ? (c.currentUtilization / c.assignedCeiling) * 100 : 0;
        return (
          <div className="w-32">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{formatCurrency(c.currentUtilization)}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'stopSupplyFlag',
      header: 'Stop Supply',
      render: (c) => c.stopSupplyFlag ? <Badge text="LOCKED" variant="danger" /> : <Badge text="OK" variant="success" />,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/customers', {
        legalName: form.legalName,
        tradeName: form.tradeName,
        customerType: form.customerType,
        phoneNumber: form.phoneNumber,
        assignedCeiling: parseFloat(form.assignedCeiling),
      });
      setShowModal(false);
      setForm({ legalName: '', tradeName: '', customerType: 'DEALER', phoneNumber: '', assignedCeiling: '' });
      refetch();
    } catch {
      // handle error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">All Customers</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Customer
        </button>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={loading} onRowClick={(c) => navigate(`/customers/${c.customerId}`)} searchPlaceholder="Search customers..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Customer">
        <form onSubmit={handleSubmit}>
          <FormField label="Legal Name" value={form.legalName} onChange={(v) => setForm({ ...form, legalName: v })} required />
          <FormField label="Trade Name" value={form.tradeName} onChange={(v) => setForm({ ...form, tradeName: v })} />
          <FormField label="Type" value={form.customerType} onChange={(v) => setForm({ ...form, customerType: v })} options={[{ value: 'DEALER', label: 'Dealer' }, { value: 'INDIVIDUAL', label: 'Individual' }]} />
          <FormField label="Phone" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} />
          <FormField label="Assigned Sub-Limit (₹)" type="number" value={form.assignedCeiling} onChange={(v) => setForm({ ...form, assignedCeiling: v })} required />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

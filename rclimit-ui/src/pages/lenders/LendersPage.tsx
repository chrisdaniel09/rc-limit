import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface Lender {
  lenderId: string;
  name: string;
  code: string;
  baseInterestRate: number;
  defaultTenureLimitDays: number;
  status: string;
}

export default function LendersPage() {
  const { data, loading, refetch } = useFetch<Lender[]>('/api/v1/lenders');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', baseInterestRate: '', defaultTenureLimitDays: '45' });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Lender>[] = [
    { key: 'name', header: 'Name' },
    { key: 'code', header: 'Code' },
    { key: 'baseInterestRate', header: 'Base Rate %', render: (l) => `${l.baseInterestRate}%` },
    { key: 'defaultTenureLimitDays', header: 'Tenure Days' },
    { key: 'status', header: 'Status', render: (l) => <Badge text={l.status} variant={statusVariant(l.status)} /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/lenders', {
        name: form.name,
        code: form.code,
        baseInterestRate: parseFloat(form.baseInterestRate),
        defaultTenureLimitDays: parseInt(form.defaultTenureLimitDays),
      });
      setShowModal(false);
      setForm({ name: '', code: '', baseInterestRate: '', defaultTenureLimitDays: '45' });
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
        <h2 className="text-lg font-semibold text-gray-900">All Lenders</h2>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          Add Lender
        </button>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={loading} searchPlaceholder="Search lenders..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Lender">
        <form onSubmit={handleSubmit}>
          <FormField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <FormField label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required placeholder="e.g. CHOLA_CV" />
          <FormField label="Base Interest Rate (%)" type="number" value={form.baseInterestRate} onChange={(v) => setForm({ ...form, baseInterestRate: v })} required />
          <FormField label="Default Tenure (days)" type="number" value={form.defaultTenureLimitDays} onChange={(v) => setForm({ ...form, defaultTenureLimitDays: v })} required />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

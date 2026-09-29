import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface Partner {
  partnerId: string;
  legalName: string;
  partnerType: string;
  phoneNumber: string;
  defaultCommissionSplitPct: number;
  status: string;
}

export default function PartnersPage() {
  const { data, loading, refetch } = useFetch<Partner[]>('/api/v1/partners');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ legalName: '', partnerType: 'SUB_BROKER', phoneNumber: '', defaultCommissionSplitPct: '70' });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Partner>[] = [
    { key: 'legalName', header: 'Legal Name' },
    { key: 'partnerType', header: 'Type', render: (p) => <Badge text={p.partnerType.replace('_', ' ')} variant="info" /> },
    { key: 'phoneNumber', header: 'Phone' },
    { key: 'defaultCommissionSplitPct', header: 'Commission %', render: (p) => `${p.defaultCommissionSplitPct}%` },
    { key: 'status', header: 'Status', render: (p) => <Badge text={p.status} variant={statusVariant(p.status)} /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/partners', {
        legalName: form.legalName,
        partnerType: form.partnerType,
        phoneNumber: form.phoneNumber,
        defaultCommissionSplitPct: parseFloat(form.defaultCommissionSplitPct),
      });
      setShowModal(false);
      setForm({ legalName: '', partnerType: 'SUB_BROKER', phoneNumber: '', defaultCommissionSplitPct: '70' });
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
        <h2 className="text-lg font-semibold text-gray-900">All Partners</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Partner
        </button>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={loading} searchPlaceholder="Search partners..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Partner">
        <form onSubmit={handleSubmit}>
          <FormField label="Legal Name" value={form.legalName} onChange={(v) => setForm({ ...form, legalName: v })} required />
          <FormField label="Type" value={form.partnerType} onChange={(v) => setForm({ ...form, partnerType: v })} options={[{ value: 'SUB_BROKER', label: 'Sub-Broker' }, { value: 'DSA_AGENT', label: 'DSA Agent' }]} />
          <FormField label="Phone" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} />
          <FormField label="Commission Split (%)" type="number" value={form.defaultCommissionSplitPct} onChange={(v) => setForm({ ...form, defaultCommissionSplitPct: v })} required />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface ParticularType {
  particularTypeId: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export default function ParticularTypesPage() {
  const { data, loading, refetch } = useFetch<ParticularType[]>('/api/v1/particular-types');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ParticularType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ code: '', label: '', sortOrder: '0', isActive: true });

  const columns: Column<ParticularType>[] = [
    { key: 'sortOrder', header: '#', render: (t) => <span className="text-gray-400">{t.sortOrder}</span> },
    { key: 'code', header: 'Code', render: (t) => <span className="font-mono text-xs">{t.code}</span> },
    { key: 'label', header: 'Display Label' },
    { key: 'isActive', header: 'Status', render: (t) => <Badge text={t.isActive ? 'Active' : 'Inactive'} variant={t.isActive ? 'success' : 'neutral'} /> },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', label: '', sortOrder: String((data?.length ?? 0) + 1), isActive: true });
    setShowModal(true);
  };

  const openEdit = (item: ParticularType) => {
    setEditing(item);
    setForm({ code: item.code, label: item.label, sortOrder: String(item.sortOrder), isActive: item.isActive });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await apiPut(`/api/v1/particular-types/${editing.particularTypeId}`, {
          label: form.label,
          sortOrder: parseInt(form.sortOrder) || 0,
          isActive: form.isActive,
        });
      } else {
        await apiPost('/api/v1/particular-types', {
          code: form.code,
          label: form.label,
          sortOrder: parseInt(form.sortOrder) || 0,
        });
      }
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Disbursal Line Item Types</h2>
          <p className="text-sm text-gray-500 mt-1">Manage the particular types available when adding disbursal line items to loans</p>
        </div>
        <button onClick={openCreate} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Type
        </button>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={loading} onRowClick={openEdit} searchPlaceholder="Search types..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Particular Type' : 'Add Particular Type'}>
        <form onSubmit={handleSubmit}>
          {editing ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <p className="mt-1 text-sm font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">{form.code}</p>
            </div>
          ) : (
            <FormField label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase().replace(/\s+/g, '_') })} required placeholder="e.g. STAMP_DUTY" />
          )}
          <FormField label="Display Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} required placeholder="e.g. Stamp Duty Charges" />
          <FormField label="Sort Order" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} required />
          {editing && (
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Active
              </label>
            </div>
          )}
          {!editing && (
            <p className="text-xs text-gray-500 mt-2">After creating this type, set up a matching <strong>Posting Rule</strong> under Accounting to map it to debit/credit accounts.</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

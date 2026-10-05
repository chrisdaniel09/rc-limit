import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import DataTable, { type Column } from '../../components/DataTable';

interface Right {
  rightId: string;
  code: string;
  module: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function RightsPage() {
  const { data: rights, loading, refetch } = useFetch<Right[]>('/api/v1/rights', []);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Right | null>(null);
  const [form, setForm] = useState({ code: '', module: '', name: '', description: '', isActive: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modules = [...new Set(rights?.map(r => r.module) || [])];

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', module: '', name: '', description: '', isActive: true });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (right: Right) => {
    setEditing(right);
    setForm({ code: right.code, module: right.module, name: right.name, description: right.description || '', isActive: right.isActive });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await apiPut(`/api/v1/rights/${editing.rightId}`, {
          name: form.name,
          description: form.description,
          isActive: form.isActive
        });
      } else {
        await apiPost('/api/v1/rights', {
          code: form.code,
          module: form.module,
          name: form.name,
          description: form.description
        });
      }
      setShowModal(false);
      refetch();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Right>[] = [
    { key: 'module', header: 'Module' },
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'isActive', header: 'Status', render: (item: Right) => <Badge text={item.isActive ? 'Active' : 'Inactive'} variant={item.isActive ? 'success' : 'neutral'} /> }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rights</h1>
            <p className="text-sm text-gray-600">Manage system permissions catalogue</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Add Right
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading rights...</div>
        ) : (
          <DataTable
            columns={columns}
            data={rights || []}
            onRowClick={openEdit}
          />
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit Right: ${editing.code}` : 'Add Right'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}

          <FormField
            label="Code"
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v })}
            required
            disabled={!!editing}
            placeholder="e.g. loans.create"
          />

          <FormField
            label="Module"
            value={form.module}
            onChange={(v) => setForm({ ...form, module: v })}
            required
            options={modules.map(m => ({ value: m, label: m }))}
            placeholder="Select module"
          />

          <FormField
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            placeholder="e.g. Create Loans"
          />

          <FormField
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Optional description"
          />

          {editing && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

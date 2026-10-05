import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import DataTable from '../../components/DataTable';

interface Right {
  rightId: string;
  code: string;
  module: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface Role {
  roleId: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  rights: Right[];
}

export default function RolesPage() {
  const { data: roles, loading, refetch } = useFetch<Role[]>('/api/v1/roles', []);
  const { data: rights } = useFetch<Right[]>('/api/v1/rights', []);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', isActive: true });
  const [selectedRights, setSelectedRights] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '', isActive: true });
    setSelectedRights([]);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setForm({ code: role.code, name: role.name, description: role.description || '', isActive: role.isActive });
    setSelectedRights(role.rights.map(r => r.rightId));
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let roleId: string;
      if (editing) {
        if (editing.isSystem) {
          setError('Cannot modify system roles');
          setSubmitting(false);
          return;
        }
        await apiPut(`/api/v1/roles/${editing.roleId}`, {
          name: form.name,
          description: form.description,
          isActive: form.isActive
        });
        roleId = editing.roleId;
      } else {
        const created = await apiPost('/api/v1/roles', {
          code: form.code,
          name: form.name,
          description: form.description
        });
        roleId = created.roleId;
      }

      // Set rights
      await apiPut(`/api/v1/roles/${roleId}/rights`, {
        rightIds: selectedRights
      });

      setShowModal(false);
      refetch();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const rightsByModule = rights ? rights.reduce((acc, right) => {
    if (!acc[right.module]) acc[right.module] = [];
    acc[right.module].push(right);
    return acc;
  }, {} as Record<string, Right[]>) : {};

  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    { key: 'isSystem', header: 'System', render: (val: boolean) => val ? <Badge text="System" variant="info" /> : '-' },
    { key: 'isActive', header: 'Status', render: (val: boolean) => <Badge text={val ? 'Active' : 'Inactive'} variant={val ? 'success' : 'neutral'} /> }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
            <p className="text-sm text-gray-600">Manage user roles and permissions</p>
          </div>
          <button
            onClick={openCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Add Role
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading roles...</div>
        ) : (
          <DataTable
            columns={columns}
            data={roles || []}
            onRowClick={openEdit}
          />
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit Role: ${editing.name}` : 'Add Role'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}

          <FormField
            label="Code"
            value={form.code}
            onChange={(v) => setForm({ ...form, code: v })}
            required
            disabled={!!editing}
            placeholder="e.g. FINANCE_MANAGER"
          />

          <FormField
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            placeholder="e.g. Finance Manager"
          />

          <FormField
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Optional description"
          />

          {editing && !editing.isSystem && (
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

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Assign Rights</h3>
            <div className="space-y-4">
              {Object.entries(rightsByModule).map(([module, moduleRights]) => (
                <div key={module} className="border rounded p-3">
                  <h4 className="font-medium text-gray-700 mb-2">{module}</h4>
                  <div className="space-y-2">
                    {moduleRights?.map(right => (
                      <label key={right.rightId} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedRights.includes(right.rightId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRights([...selectedRights, right.rightId]);
                            } else {
                              setSelectedRights(selectedRights.filter(id => id !== right.rightId));
                            }
                          }}
                          className="rounded border-gray-300 mt-1"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{right.name}</div>
                          {right.description && <div className="text-xs text-gray-500">{right.description}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

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

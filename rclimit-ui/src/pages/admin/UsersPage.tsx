import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPut } from '../../api/client';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import DataTable from '../../components/DataTable';

interface Role {
  roleId: string;
  code: string;
  name: string;
}

interface User {
  userId: string;
  email: string;
  fullName: string;
  roles?: Role[];
  rightCodes?: string[];
}

export default function UsersPage() {
  const { data: users, loading, refetch } = useFetch<User[]>('/api/v1/users', []);
  const { data: roles } = useFetch<Role[]>('/api/v1/roles', []);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openEdit = (user: User) => {
    setEditing(user);
    setSelectedRoleIds(user.roles?.map(r => r.roleId) || []);
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPut(`/api/v1/users/${editing.userId}/roles`, {
        roleIds: selectedRoleIds
      });
      setShowModal(false);
      refetch();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'email', header: 'Email' },
    { key: 'fullName', header: 'Full Name' },
    {
      key: 'roles',
      header: 'Roles',
      render: (roles: Role[]) => (
        <div className="text-sm">
          {roles && roles.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {roles.map(r => (
                <span key={r.roleId} className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
                  {r.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-500">No roles</span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-600">Manage user roles and access</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500 mt-4">Loading users...</div>
        ) : (
          <div className="mt-4">
            <DataTable
              columns={columns}
              data={users || []}
              onRowClick={openEdit}
            />
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Assign Roles: ${editing.fullName}` : ''}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}

          {editing && (
            <>
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div className="text-gray-700">
                  <div className="font-medium">{editing.fullName}</div>
                  <div className="text-gray-600">{editing.email}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">Assign Roles</label>
                <div className="space-y-2 border rounded p-3 bg-gray-50 max-h-96 overflow-y-auto">
                  {roles && roles.length > 0 ? (
                    roles.map(role => (
                      <label key={role.roleId} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedRoleIds.includes(role.roleId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoleIds([...selectedRoleIds, role.roleId]);
                            } else {
                              setSelectedRoleIds(selectedRoleIds.filter(id => id !== role.roleId));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{role.name}</div>
                          <div className="text-xs text-gray-500">{role.code}</div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No roles available</div>
                  )}
                </div>
              </div>
            </>
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

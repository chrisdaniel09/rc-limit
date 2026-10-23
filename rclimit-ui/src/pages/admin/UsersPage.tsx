import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import Modal from '../../components/Modal';
import DataTable, { type Column } from '../../components/DataTable';
import FormField from '../../components/FormField';

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

const MIN_PASSWORD_LENGTH = 12;

const emptyCreateForm = { email: '', fullName: '', phoneNumber: '', password: '', confirmPassword: '' };

function RoleChecklist({
  roles,
  selectedRoleIds,
  onChange,
}: {
  roles: Role[] | null;
  selectedRoleIds: string[];
  onChange: (roleIds: string[]) => void;
}) {
  return (
    <div className="space-y-2 border rounded p-3 bg-gray-50 max-h-64 overflow-y-auto">
      {roles && roles.length > 0 ? (
        roles.map(role => (
          <label key={role.roleId} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedRoleIds.includes(role.roleId)}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...selectedRoleIds, role.roleId]
                    : selectedRoleIds.filter(id => id !== role.roleId)
                );
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
  );
}

export default function UsersPage() {
  const { data: users, loading, refetch } = useFetch<User[]>('/api/v1/users', []);
  const { data: roles } = useFetch<Role[]>('/api/v1/roles', []);

  // Edit (roles + credential reset) state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Create user state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createRoleIds, setCreateRoleIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const openEdit = (user: User) => {
    setEditing(user);
    setSelectedRoleIds(user.roles?.map(r => r.roleId) || []);
    setError(null);
    setResetPassword('');
    setResetConfirm('');
    setResetError(null);
    setResetMessage(null);
    setShowModal(true);
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm);
    setCreateRoleIds([]);
    setCreateError(null);
    setShowCreate(true);
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

  const handleResetPassword = async () => {
    if (!editing) return;
    setResetError(null);
    setResetMessage(null);
    if (resetPassword.length < MIN_PASSWORD_LENGTH) {
      setResetError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetting(true);
    try {
      await apiPut(`/api/v1/users/${editing.userId}/password`, { newPassword: resetPassword });
      setResetPassword('');
      setResetConfirm('');
      setResetMessage(`Password reset for ${editing.email}. Their existing sessions have been signed out.`);
    } catch (err: any) {
      setResetError(err.message || 'Password reset failed');
    } finally {
      setResetting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (createForm.password.length < MIN_PASSWORD_LENGTH) {
      setCreateError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError('Passwords do not match.');
      return;
    }
    setCreating(true);
    try {
      await apiPost('/api/v1/users', {
        email: createForm.email.trim(),
        fullName: createForm.fullName.trim(),
        phoneNumber: createForm.phoneNumber.trim() || null,
        password: createForm.password,
        roleIds: createRoleIds,
      });
      setShowCreate(false);
      refetch();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<User>[] = [
    { key: 'email', header: 'Email' },
    { key: 'fullName', header: 'Full Name' },
    {
      key: 'roles',
      header: 'Roles',
      render: (user: User) => (
        <div className="text-sm">
          {user.roles && user.roles.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {user.roles.map(r => (
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
            <p className="text-sm text-gray-600">Create users, assign roles and reset credentials</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            New User
          </button>
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New User">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{createError}</div>}

          <FormField label="Email" type="email" value={createForm.email} onChange={(v) => setCreateForm({ ...createForm, email: v })} required />
          <FormField label="Full Name" value={createForm.fullName} onChange={(v) => setCreateForm({ ...createForm, fullName: v })} required />
          <FormField label="Phone Number" value={createForm.phoneNumber} onChange={(v) => setCreateForm({ ...createForm, phoneNumber: v })} placeholder="+919876543210" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Initial Password" type="password" value={createForm.password} onChange={(v) => setCreateForm({ ...createForm, password: v })} required placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
            <FormField label="Confirm Password" type="password" value={createForm.confirmPassword} onChange={(v) => setCreateForm({ ...createForm, confirmPassword: v })} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Roles</label>
            <RoleChecklist roles={roles} selectedRoleIds={createRoleIds} onChange={setCreateRoleIds} />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Manage User: ${editing.fullName}` : ''}>
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
                <RoleChecklist roles={roles} selectedRoleIds={selectedRoleIds} onChange={setSelectedRoleIds} />
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
              {submitting ? 'Saving...' : 'Save Roles'}
            </button>
          </div>
        </form>

        {editing && (
          <div className="mt-6 pt-4 border-t space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Reset Password</h3>
            <p className="text-xs text-gray-500">Sets a new password and signs the user out of all active sessions.</p>
            {resetError && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{resetError}</div>}
            {resetMessage && <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">{resetMessage}</div>}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="New Password" type="password" value={resetPassword} onChange={setResetPassword} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
              <FormField label="Confirm Password" type="password" value={resetConfirm} onChange={setResetConfirm} />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting || !resetPassword}
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

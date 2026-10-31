import { useEffect, useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { apiPost, apiPut } from '@/api/client';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useListState } from '@/hooks/useListState';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { PhoneInput } from '@/components/inputs';
import Pagination from '@/components/Pagination';
import Badge from '@/components/Badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/choice';
import { useConfirm } from '@/components/ui/confirm';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { FieldGrid, FormSection } from '@/components/ui/field';
import { Empty } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { errorMessage, notifyError, notifySuccess } from '@/components/ui/toast';
import { Avatar } from '@/layouts/Topbar';
import { PageHeader } from '@/layouts/templates';
import { INDIAN_MOBILE_MESSAGE, isValidIndianMobile, toPhoneNumber } from '@/utils/phone';
import { MIN_PASSWORD_LENGTH, StrengthMeter, type Role } from './adminShared';

interface User {
  userId: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  roles?: Role[];
}

function RoleChecklist({ roles, selected, onChange }: { roles: Role[]; selected: string[]; onChange: (ids: string[]) => void }) {
  if (roles.length === 0) return <p className="text-sm text-muted-foreground">No roles yet.</p>;
  return (
    <div className="space-y-1 rounded-lg border p-3">
      {roles.map((r) => (
        <Checkbox
          key={r.roleId}
          label={r.name}
          description={r.description || r.code}
          checked={selected.includes(r.roleId)}
          onCheckedChange={(checked) => onChange(checked ? [...selected, r.roleId] : selected.filter((id) => id !== r.roleId))}
        />
      ))}
    </div>
  );
}

const passwordRules = z.string().min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`);

const createSchema = z.object({
  email: z.email('Enter a valid email'),
  fullName: z.string().trim().min(2, 'Enter the full name').max(200),
  phoneNumber: z.string().refine((v) => v === '' || isValidIndianMobile(v), INDIAN_MOBILE_MESSAGE),
  password: passwordRules,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" });

const resetSchema = z.object({ password: passwordRules, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" });

function CreateUserDialog({ open, onOpenChange, roles, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; roles: Role[]; onCreated: () => void }) {
  const form = useZodForm(createSchema, { email: '', fullName: '', phoneNumber: '', password: '', confirmPassword: '' });
  const { control, handleSubmit, reset, watch, formState } = form;
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      reset();
      setRoleIds([]);
      setServerError(null);
    }
  }, [open, reset]);

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await apiPost('/api/v1/users', { email: v.email.trim(), fullName: v.fullName.trim(), phoneNumber: toPhoneNumber(v.phoneNumber), password: v.password, roleIds });
      notifySuccess('User created');
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setServerError(errorMessage(err, "The user wasn't created."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New user"
      size="lg"
      dirty={formState.isDirty || roleIds.length > 0}
      error={serverError}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Creating…">Create user</Button>
        </>
      }
    >
      <div className="space-y-5">
        <FieldGrid>
          <FormField control={control} name="fullName" label="Full name" required render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} autoFocus />} />
          <FormField control={control} name="email" label="Email" required render={(f) => <Input type="email" autoComplete="off" value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
        </FieldGrid>
        <FormField control={control} name="phoneNumber" label="Phone" optional render={(f) => <PhoneInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} />} />
        <FieldGrid>
          <FormField control={control} name="password" label="Initial password" required render={(f) => <Input type="password" autoComplete="new-password" value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
          <FormField control={control} name="confirmPassword" label="Confirm password" required render={(f) => <Input type="password" autoComplete="new-password" value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
        </FieldGrid>
        <StrengthMeter password={watch('password')} />
        <FormSection title="Roles"><RoleChecklist roles={roles} selected={roleIds} onChange={setRoleIds} /></FormSection>
      </div>
    </ResponsiveDialog>
  );
}

// Side sheet: profile, roles, and reset password at the bottom (§10.12).
function UserSheet({ user, onOpenChange, roles, onSaved }: { user: User | null; onOpenChange: (o: boolean) => void; roles: Role[]; onSaved: () => void }) {
  const confirm = useConfirm();
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const resetForm = useZodForm(resetSchema, { password: '', confirmPassword: '' });

  useEffect(() => {
    if (!user) return;
    setRoleIds(user.roles?.map((r) => r.roleId) ?? []);
    setServerError(null);
    resetForm.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;
  const rolesDirty = [...roleIds].sort().join() !== (user.roles?.map((r) => r.roleId) ?? []).sort().join();

  const saveRoles = async () => {
    setSavingRoles(true);
    setServerError(null);
    try {
      await apiPut(`/api/v1/users/${user.userId}/roles`, { roleIds });
      notifySuccess('Roles saved');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setServerError(errorMessage(err, "The roles weren't saved."));
    } finally {
      setSavingRoles(false);
    }
  };

  const resetPassword = resetForm.handleSubmit(async (v) => {
    const ok = await confirm({
      title: `Reset ${user.fullName}'s password?`,
      description: 'They are signed out of every session and must use the new password.',
      confirmLabel: 'Reset password',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await apiPut(`/api/v1/users/${user.userId}/password`, { newPassword: v.password });
      resetForm.reset();
      notifySuccess('Password reset', { description: `${user.email} was signed out of all sessions.` });
    } catch (err) {
      notifyError(err, "The password wasn't reset");
    }
  });

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      variant="sheet"
      title={user.fullName}
      description={user.email}
      dirty={rolesDirty}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button loading={savingRoles} loadingText="Saving…" disabled={!rolesDirty} onClick={() => void saveRoles()}>Save roles</Button>
        </>
      }
    >
      <div className="space-y-6">
        <FormSection title="Roles"><RoleChecklist roles={roles} selected={roleIds} onChange={setRoleIds} /></FormSection>
        <section className="space-y-3 rounded-lg border border-danger/30 p-4">
          <div>
            <h3 className="text-subheading">Reset password</h3>
            <p className="text-caption text-muted-foreground">Sets a new password and signs the user out of every session.</p>
          </div>
          <FormField control={resetForm.control} name="password" label="New password" render={(f) => <Input type="password" autoComplete="new-password" value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
          <FormField control={resetForm.control} name="confirmPassword" label="Confirm password" render={(f) => <Input type="password" autoComplete="new-password" value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
          <StrengthMeter password={resetForm.watch('password')} />
          <Button variant="outline-danger" icon={KeyRound} loading={resetForm.formState.isSubmitting} onClick={() => void resetPassword()}>Reset password</Button>
        </section>
      </div>
    </ResponsiveDialog>
  );
}

export default function UsersPage() {
  const list = useListState({ storageKey: 'users.pageSize', defaultSortBy: 'email', defaultSortDir: 'asc', initialFilters: {} as Record<string, string> });
  const { data: users, meta, loading, error, refetch } = useFetch<User[]>(`/api/v1/users?${list.query}`, [], { staleAfter: LIST_STALE_MS });
  const { data: roles } = useFetch<Role[]>('/api/v1/roles');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  const columns: ColumnDef<User>[] = [
    {
      id: 'name', header: 'Name', sortKey: 'fullName', mobile: 'title',
      cell: (u) => (
        <span className="inline-flex items-center gap-2">
          <Avatar name={u.fullName} size="sm" />
          <span>
            <span className="block">{u.fullName}</span>
            <span className="block text-caption font-normal text-muted-foreground">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'roles', header: 'Roles', mobile: 'meta',
      cell: (u) => {
        const r = u.roles ?? [];
        if (r.length === 0) return <Empty>No roles</Empty>;
        return (
          <span className="flex flex-wrap gap-1">
            {r.slice(0, 3).map((role) => <Badge key={role.roleId} text={role.name} variant="progress" />)}
            {r.length > 3 && <Badge text={`+${r.length - 3}`} />}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        count={meta?.totalCount}
        description="Create users, assign roles and reset credentials."
        actions={<Button icon={UserPlus} data-new-record onClick={() => setCreateOpen(true)}>New user</Button>}
      />
      <FilterBar searchValue={list.searchInput} onSearchChange={list.setSearchInput} searchPlaceholder="Search email or name…" resultCount={meta?.totalCount} resultLabel="users" />
      <DataTable
        label="Users"
        columns={columns}
        rows={users}
        getRowId={(u) => u.userId}
        loading={loading}
        error={error}
        onRetry={refetch}
        onRowClick={setEditing}
        sort={{ sortBy: list.sortBy, sortDir: list.sortDir, onSort: list.updateSort, onSortChange: list.setSort }}
        isFiltered={list.isFiltered}
        onClearFilters={list.clearFilters}
        accumulate={{ page: list.page, viewKey: list.viewKey }}
        empty={{ title: 'No users yet', action: <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>New user</Button> }}
        footer={<Pagination meta={meta} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} loading={loading} />}
      />
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} roles={roles ?? []} onCreated={() => (list.page === 1 ? void refetch() : list.setPage(1))} />
      <UserSheet user={editing} onOpenChange={(o) => !o && setEditing(null)} roles={roles ?? []} onSaved={() => void refetch()} />
    </>
  );
}


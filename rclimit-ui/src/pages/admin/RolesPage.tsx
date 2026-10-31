import { useEffect, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { apiPost, apiPut } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import StatusBadge from '@/components/StatusBadge';
import Badge from '@/components/Badge';
import { CodeInput } from '@/components/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field, FormSection } from '@/components/ui/field';
import { Empty } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import { RightsMatrix, type Right, type Role } from './adminShared';

// §10.12 Roles: list + side sheet editor with the rights matrix.
export default function RolesPage() {
  const { data: roles, loading, error, refetch } = useFetch<Role[]>('/api/v1/roles');
  const { data: rights } = useFetch<Right[]>('/api/v1/rights');
  const list = useClientFilter(roles, (r) => [r.name, r.code, r.description]);
  const [editor, setEditor] = useState<{ open: boolean; role: Role | null }>({ open: false, role: null });
  const [form, setForm] = useState({ code: '', name: '', description: '', isActive: true });
  const [selected, setSelected] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor.open) return;
    const r = editor.role;
    setForm({ code: r?.code ?? '', name: r?.name ?? '', description: r?.description ?? '', isActive: r?.isActive ?? true });
    setSelected(r?.rights?.map((x) => x.rightId) ?? []);
    setDirty(false);
    setServerError(null);
  }, [editor]);

  const locked = !!editor.role?.isSystem;
  const patch = (p: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...p }));
    setDirty(true);
  };

  const save = async () => {
    if (locked) return;
    if (!form.name.trim() || (!editor.role && !form.code.trim())) {
      setServerError('Enter a code and a name.');
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      let roleId: string;
      if (editor.role) {
        await apiPut(`/api/v1/roles/${editor.role.roleId}`, { name: form.name.trim(), description: form.description, isActive: form.isActive });
        roleId = editor.role.roleId;
      } else {
        const created = await apiPost<{ data?: { roleId: string }; roleId?: string }>('/api/v1/roles', { code: form.code, name: form.name.trim(), description: form.description });
        roleId = created?.data?.roleId ?? created.roleId!;
      }
      await apiPut(`/api/v1/roles/${roleId}/rights`, { rightIds: selected });
      notifySuccess(editor.role ? 'Role saved' : 'Role added');
      setEditor({ open: false, role: null });
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, "The role wasn't saved."));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<Role>[] = [
    {
      id: 'name', header: 'Name', mobile: 'title',
      cell: (r) => (
        <span>
          <span className="block">{r.name}</span>
          {r.description && <span className="block max-w-80 truncate text-caption font-normal text-muted-foreground">{r.description}</span>}
        </span>
      ),
    },
    { id: 'code', header: 'Code', kind: 'id', mobile: 'subtitle', cell: (r) => r.code },
    { id: 'rights', header: 'Rights', kind: 'number', mobile: 'meta', cell: (r) => r.rights?.length ?? 0 },
    { id: 'system', header: 'System', mobile: 'badge', cell: (r) => (r.isSystem ? <Badge text="System" variant="info" icon={Lock} /> : <Empty />) },
    { id: 'status', header: 'Status', kind: 'status', mobile: 'badge', cell: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} inTable /> },
  ];

  return (
    <>
      <PageHeader
        title="Roles"
        count={roles?.length}
        description="Bundles of rights you assign to users."
        actions={<Button icon={Plus} data-new-record onClick={() => setEditor({ open: true, role: null })}>Add role</Button>}
      />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search roles…" />
      <DataTable
        label="Roles"
        columns={columns}
        rows={list.filtered}
        getRowId={(r) => r.roleId}
        loading={loading}
        error={error}
        onRetry={refetch}
        onRowClick={(r) => setEditor({ open: true, role: r })}
        isFiltered={list.isFiltered}
        onClearFilters={list.clear}
        empty={{ title: 'No roles yet', action: <Button icon={Plus} onClick={() => setEditor({ open: true, role: null })}>Add role</Button> }}
      />
      <ResponsiveDialog
        open={editor.open}
        onOpenChange={(o) => setEditor((e) => ({ ...e, open: o }))}
        variant="sheet"
        size="lg"
        title={editor.role ? editor.role.name : 'Add role'}
        dirty={dirty && !locked}
        error={serverError}
        onSubmit={() => void save()}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditor((e) => ({ ...e, open: false }))}>{locked ? 'Close' : 'Cancel'}</Button>
            {!locked && <Button type="submit" loading={saving} loadingText="Saving…">{editor.role ? 'Save role' : 'Add role'}</Button>}
          </>
        }
      >
        <div className="space-y-6">
          {locked && <Alert tone="info" icon={Lock} title="System role">System roles can't be changed. Create a new role to customise rights.</Alert>}
          <FormSection title="Details">
            <Field label="Code" required hint={editor.role ? "A code can't change once created." : undefined}>
              <CodeInput value={form.code} onValueChange={(v) => patch({ code: v.replace(/[^A-Z0-9_]/g, '_') })} readOnly={!!editor.role} placeholder="FINANCE_MANAGER" />
            </Field>
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} readOnly={locked} placeholder="Finance manager" />
            </Field>
            <Field label="Description" optional>
              <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} readOnly={locked} rows={2} maxLength={500} />
            </Field>
            {editor.role && !locked && <Switch label="Active" checked={form.isActive} onCheckedChange={(v) => patch({ isActive: v })} />}
          </FormSection>
          <FormSection title="Rights">
            <RightsMatrix rights={rights ?? []} selected={selected} onChange={(ids) => { setSelected(ids); setDirty(true); }} disabled={locked} />
          </FormSection>
        </div>
      </ResponsiveDialog>
    </>
  );
}

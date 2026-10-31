import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Edit3, Plus } from 'lucide-react';
import { apiPost, apiPut } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import StatusBadge from '@/components/StatusBadge';
import { CodeInput, IntegerInput } from '@/components/inputs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage, notifyError, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';

// §10.11 simple masters: a code/label list with sort order and an Active switch, edited in a side sheet.

export interface MasterRow {
  code: string;
  label: string;
  sortOrder?: number;
  isActive: boolean;
}

interface SimpleMasterPageProps<T extends MasterRow> {
  title: string;
  description: string;
  endpoint: string;
  idOf: (row: T) => string;
  // Update isn't offered by every master.
  canUpdate: boolean;
  noun: string;
  codePlaceholder: string;
  labelPlaceholder: string;
  createHint?: ReactNode;
}

export default function SimpleMasterPage<T extends MasterRow>({
  title, description, endpoint, idOf, canUpdate, noun, codePlaceholder, labelPlaceholder, createHint,
}: SimpleMasterPageProps<T>) {
  const { data, loading, error, refetch } = useFetch<T[]>(endpoint);
  const rows = data ? [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : data;
  const list = useClientFilter(rows, (r) => [r.code, r.label]);
  const [editor, setEditor] = useState<{ open: boolean; row: T | null }>({ open: false, row: null });
  const [form, setForm] = useState({ code: '', label: '', sortOrder: 0 as number | null, isActive: true });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor.open) return;
    const r = editor.row;
    setForm(r ? { code: r.code, label: r.label, sortOrder: r.sortOrder ?? 0, isActive: r.isActive } : { code: '', label: '', sortOrder: (data?.length ?? 0) + 1, isActive: true });
    setServerError(null);
  }, [editor, data?.length]);

  const put = (row: T, patch: Partial<MasterRow>) =>
    apiPut(`${endpoint}/${idOf(row)}`, { label: patch.label ?? row.label, sortOrder: patch.sortOrder ?? row.sortOrder ?? 0, isActive: patch.isActive ?? row.isActive });

  const toggleActive = async (row: T, isActive: boolean) => {
    try {
      await put(row, { isActive });
      notifySuccess(`${row.label} ${isActive ? 'activated' : 'deactivated'}`);
      void refetch();
    } catch (err) {
      notifyError(err, "The change wasn't saved");
    }
  };

  // Reorder by swapping sort orders with the neighbour.
  const moveRow = async (index: number, delta: number) => {
    if (!rows) return;
    const a = rows[index];
    const b = rows[index + delta];
    if (!a || !b) return;
    try {
      await Promise.all([put(a, { sortOrder: b.sortOrder ?? index + delta }), put(b, { sortOrder: a.sortOrder ?? index })]);
      void refetch();
    } catch (err) {
      notifyError(err, "The order wasn't saved");
    }
  };

  const save = async () => {
    if (!form.label.trim() || (!editor.row && !form.code.trim())) {
      setServerError('Enter a code and a label.');
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      if (editor.row) await put(editor.row, { label: form.label.trim(), sortOrder: form.sortOrder ?? 0, isActive: form.isActive });
      else await apiPost(endpoint, { code: form.code, label: form.label.trim(), sortOrder: form.sortOrder ?? 0 });
      notifySuccess(editor.row ? `${noun} saved` : `${noun} added`);
      setEditor({ open: false, row: null });
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, `The ${noun.toLowerCase()} wasn't saved.`));
    } finally {
      setSaving(false);
    }
  };

  const reorderable = canUpdate && !list.isFiltered;
  const columns: ColumnDef<T>[] = [
    {
      id: 'order', header: '#', kind: 'number', mobile: 'hidden', className: 'w-24',
      cell: (r) => {
        const index = rows?.indexOf(r) ?? -1;
        return reorderable ? (
          <span className="inline-flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${r.label} up`} disabled={index <= 0} onClick={() => void moveRow(index, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Move ${r.label} down`} disabled={index === (rows?.length ?? 0) - 1} onClick={() => void moveRow(index, 1)}><ArrowDown /></Button>
          </span>
        ) : <span className="text-muted-foreground">{r.sortOrder ?? '—'}</span>;
      },
    },
    { id: 'label', header: 'Label', mobile: 'title', cell: (r) => r.label },
    { id: 'code', header: 'Code', kind: 'id', mobile: 'subtitle', cell: (r) => r.code },
    {
      id: 'active', header: 'Active', mobile: 'badge',
      cell: (r) => (canUpdate
        ? <Switch aria-label={`${r.label} active`} checked={r.isActive} onCheckedChange={(v) => void toggleActive(r, v)} />
        : <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} inTable />),
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        count={data?.length}
        description={description}
        actions={<Button icon={Plus} data-new-record onClick={() => setEditor({ open: true, row: null })}>Add {noun.toLowerCase()}</Button>}
      />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder={`Search ${title.toLowerCase()}…`} />
      <DataTable
        label={title}
        columns={columns}
        rows={list.filtered}
        getRowId={idOf}
        loading={loading}
        error={error}
        onRetry={refetch}
        isFiltered={list.isFiltered}
        onClearFilters={list.clear}
        rowActions={canUpdate ? (r) => [{ label: 'Edit', icon: Edit3, onSelect: () => setEditor({ open: true, row: r }) }] : undefined}
        empty={{ title: `No ${title.toLowerCase()} yet`, action: <Button icon={Plus} onClick={() => setEditor({ open: true, row: null })}>Add {noun.toLowerCase()}</Button> }}
      />
      <ResponsiveDialog
        open={editor.open}
        onOpenChange={(o) => setEditor((e) => ({ ...e, open: o }))}
        variant="sheet"
        title={editor.row ? `Edit ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`}
        error={serverError}
        onSubmit={() => void save()}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditor((e) => ({ ...e, open: false }))}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText="Saving…">{editor.row ? 'Save' : `Add ${noun.toLowerCase()}`}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Code" required hint={editor.row ? "A code can't change once created." : undefined}>
            <CodeInput value={form.code} onValueChange={(v) => setForm((f) => ({ ...f, code: v.replace(/[^A-Z0-9_]/g, '_') }))} readOnly={!!editor.row} placeholder={codePlaceholder} />
          </Field>
          <Field label="Label" required>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={labelPlaceholder} autoFocus />
          </Field>
          <Field label="Sort order" required>
            <IntegerInput value={form.sortOrder} onValueChange={(v) => setForm((f) => ({ ...f, sortOrder: v }))} min={0} max={999} />
          </Field>
          {editor.row && (
            <Switch label="Active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
          )}
          {!editor.row && createHint && <p className="text-caption text-muted-foreground">{createHint}</p>}
        </div>
      </ResponsiveDialog>
    </>
  );
}

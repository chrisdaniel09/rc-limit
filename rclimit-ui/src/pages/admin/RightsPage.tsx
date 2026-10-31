import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiPost, apiPut } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import { FilterBar } from '@/components/FilterBar';
import StatusBadge from '@/components/StatusBadge';
import { CodeInput } from '@/components/inputs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import { humanize } from '@/lib/format';
import type { Right } from './adminShared';

// §10.12 Rights: a read-mostly list grouped by module.
export default function RightsPage() {
  const { data: rights, loading, refetch } = useFetch<Right[]>('/api/v1/rights');
  const list = useClientFilter(rights, (r) => [r.code, r.name, r.module, r.description]);
  const [editor, setEditor] = useState<{ open: boolean; right: Right | null }>({ open: false, right: null });
  const [form, setForm] = useState({ code: '', module: '', name: '', description: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const modules = useMemo(() => [...new Set((rights ?? []).map((r) => r.module))].sort(), [rights]);
  const groups = useMemo(() => {
    const map = new Map<string, Right[]>();
    for (const r of list.filtered ?? []) map.set(r.module, [...(map.get(r.module) ?? []), r]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [list.filtered]);

  useEffect(() => {
    if (!editor.open) return;
    const r = editor.right;
    setForm({ code: r?.code ?? '', module: r?.module ?? '', name: r?.name ?? '', description: r?.description ?? '', isActive: r?.isActive ?? true });
    setServerError(null);
  }, [editor]);

  const save = async () => {
    if (!form.name.trim() || (!editor.right && (!form.code.trim() || !form.module.trim()))) {
      setServerError('Enter a module, a code and a name.');
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      if (editor.right) await apiPut(`/api/v1/rights/${editor.right.rightId}`, { name: form.name.trim(), description: form.description, isActive: form.isActive });
      else await apiPost('/api/v1/rights', { code: form.code.trim(), module: form.module.trim(), name: form.name.trim(), description: form.description });
      notifySuccess(editor.right ? 'Right saved' : 'Right added');
      setEditor({ open: false, right: null });
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, "The right wasn't saved."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Rights"
        count={rights?.length}
        description="Permissions checked by the app. Grant them to users through roles."
        actions={<Button icon={Plus} data-new-record onClick={() => setEditor({ open: true, right: null })}>Add right</Button>}
      />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search rights…" />
      {loading && !rights ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : groups.length === 0 ? (
        <EmptyState variant={list.isFiltered ? 'no-results' : 'no-data'} title={list.isFiltered ? 'No rights match' : 'No rights yet'} />
      ) : (
        <div className="space-y-4">
          {groups.map(([module, items]) => (
            <Card key={module} title={humanize(module)} description={`${items.length} rights`} flush>
              <ul className="divide-y">
                {items.map((r) => (
                  <li key={r.rightId}>
                    <button
                      type="button"
                      onClick={() => setEditor({ open: true, right: r })}
                      className="flex w-full items-center justify-between gap-4 px-card py-3 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{r.name}</span>
                        <span className="id-mono block text-caption text-muted-foreground">{r.code}</span>
                        {r.description && <span className="mt-0.5 block text-caption text-muted-foreground">{r.description}</span>}
                      </span>
                      <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} inTable />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <ResponsiveDialog
        open={editor.open}
        onOpenChange={(o) => setEditor((e) => ({ ...e, open: o }))}
        variant="sheet"
        title={editor.right ? 'Edit right' : 'Add right'}
        error={serverError}
        onSubmit={() => void save()}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditor((e) => ({ ...e, open: false }))}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText="Saving…">{editor.right ? 'Save right' : 'Add right'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Module" required>
            {editor.right
              ? <Input value={humanize(form.module)} readOnly />
              : <Combobox value={form.module} onValueChange={(v) => setForm((f) => ({ ...f, module: v }))} options={modules.map((m) => ({ value: m, label: humanize(m) }))} placeholder="Choose a module" createAction={{ label: 'Use typed module', onSelect: (t) => t && setForm((f) => ({ ...f, module: t.toUpperCase().replace(/\s+/g, '_') })) }} />}
          </Field>
          <Field label="Code" required hint="Lower case with dots, for example loans.edit.">
            <CodeInput value={form.code} onValueChange={(v) => setForm((f) => ({ ...f, code: v.toLowerCase() }))} readOnly={!!editor.right} className="normal-case" />
          </Field>
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Description" optional><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} maxLength={500} /></Field>
          {editor.right && <Switch label="Active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />}
        </div>
      </ResponsiveDialog>
    </>
  );
}

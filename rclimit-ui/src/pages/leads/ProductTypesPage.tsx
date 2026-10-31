import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { apiPost, apiPut } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import { useIsWide } from '@/hooks/useMediaQuery';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import StatusBadge from '@/components/StatusBadge';
import { CodeInput, IntegerInput } from '@/components/inputs';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field, FieldGrid, FormSection } from '@/components/ui/field';
import { Empty } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import ProductFieldInput from './ProductFieldInput';
import { ACTION_LABELS, FIELD_TYPE_OPTIONS, ROLE_OPTIONS, type FieldType, type ProductField, type ProductType } from './productTypes';

interface FieldRow {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  role: string;
  pattern: string;
  min: string;
  max: string;
  options: string;
}

interface ProductForm {
  code: string;
  label: string;
  sortOrder: number | null;
  isActive: boolean;
  fields: FieldRow[];
  actions: string[];
}

const newId = () => crypto.randomUUID();
const emptyField = (): FieldRow => ({ id: newId(), key: '', label: '', type: 'text', required: false, role: '', pattern: '', min: '', max: '', options: '' });

const toFieldRow = (field: ProductField): FieldRow => ({
  id: newId(),
  key: field.key,
  label: field.label,
  type: field.type,
  required: field.required,
  role: field.role ?? '',
  pattern: field.validation?.pattern ?? '',
  min: field.validation?.min?.toString() ?? '',
  max: field.validation?.max?.toString() ?? '',
  options: field.validation?.options?.join(', ') ?? '',
});

// Only the validation that applies to the field's type is sent. The backend checks it again.
const toValidation = (row: FieldRow) => {
  if (row.type === 'text' && row.pattern.trim()) return { pattern: row.pattern.trim(), min: null, max: null, options: null };
  if (row.type === 'number') return { pattern: null, min: row.min === '' ? null : Number(row.min), max: row.max === '' ? null : Number(row.max), options: null };
  if (row.type === 'select') return { pattern: null, min: null, max: null, options: row.options.split(',').map((o) => o.trim()).filter(Boolean) };
  return null;
};

const toSchema = (rows: FieldRow[]): ProductField[] => rows.map((row) => ({
  key: row.key.trim(),
  label: row.label.trim(),
  type: row.type,
  required: row.required,
  role: row.role || null,
  validation: toValidation(row),
}));

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// §10.11 Financial requirements builder.
export default function ProductTypesPage() {
  const { data, loading, error, refetch } = useFetch<ProductType[]>('/api/v1/lead-product-types');
  const sorted = data ? [...data].sort((a, b) => a.sortOrder - b.sortOrder) : data;
  const list = useClientFilter(sorted, (p) => [p.code, p.label]);
  const isWide = useIsWide();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [form, setForm] = useState<ProductForm>({ code: '', label: '', sortOrder: 1, isActive: true, fields: [], actions: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string>>({});

  const update = (patch: Partial<ProductForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const updateField = (index: number, patch: Partial<FieldRow>) => update({ fields: form.fields.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  const openEditor = (product: ProductType | null) => {
    setEditing(product);
    setServerError(null);
    setDirty(false);
    setPreview({});
    setForm(product ? {
      code: product.code,
      label: product.label,
      sortOrder: product.sortOrder,
      isActive: product.isActive,
      fields: product.fieldSchema.map(toFieldRow),
      actions: product.actions.slice().sort((a, b) => a.order - b.order).map((a) => a.code),
    } : { code: '', label: '', sortOrder: (data?.length ?? 0) + 1, isActive: true, fields: [], actions: [] });
    setOpen(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.label.trim()) {
      setServerError('Enter a code and a label.');
      return;
    }
    setSaving(true);
    setServerError(null);
    const payload = {
      code: form.code,
      label: form.label.trim(),
      sortOrder: form.sortOrder ?? 0,
      isActive: form.isActive,
      fieldSchema: toSchema(form.fields),
      actions: form.actions.map((code, i) => ({ code, order: i + 1, config: {} })),
    };
    try {
      if (editing) {
        const { code: _code, ...rest } = payload;
        await apiPut(`/api/v1/lead-product-types/${editing.productTypeId}`, rest);
      } else {
        await apiPost('/api/v1/lead-product-types', payload);
      }
      notifySuccess(editing ? 'Requirement saved' : 'Requirement added');
      setOpen(false);
      void refetch();
    } catch (err) {
      // The server explains which rule failed, so show its message.
      setServerError(errorMessage(err, "The requirement wasn't saved."));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<ProductType>[] = [
    { id: 'order', header: '#', kind: 'number', mobile: 'hidden', className: 'w-12', cell: (p) => <span className="text-muted-foreground">{p.sortOrder}</span> },
    { id: 'label', header: 'Financial requirement', mobile: 'title', cell: (p) => p.label },
    { id: 'code', header: 'Code', kind: 'id', mobile: 'subtitle', cell: (p) => p.code },
    { id: 'fields', header: 'Fields', kind: 'number', mobile: 'meta', cell: (p) => p.fieldSchema.length },
    { id: 'checks', header: 'Checks', mobile: 'meta', cell: (p) => (p.actions.length === 0 ? <Empty>None</Empty> : p.actions.slice().sort((a, b) => a.order - b.order).map((a) => ACTION_LABELS[a.code] ?? a.code).join(' → ')) },
    { id: 'status', header: 'Status', kind: 'status', mobile: 'badge', cell: (p) => <StatusBadge status={p.isActive ? 'ACTIVE' : 'INACTIVE'} inTable /> },
  ];

  const schema = toSchema(form.fields).filter((f) => f.key && f.label);

  const editor = (
    <div className="space-y-6">
      <FormSection title="Basics">
        <FieldGrid>
          <Field label="Code" required hint={editing ? "A code can't change once created." : 'Capitals and underscores, for example GOLD_LOAN.'}>
            <CodeInput value={form.code} onValueChange={(v) => update({ code: v.replace(/[^A-Z0-9_]/g, '_') })} readOnly={!!editing} placeholder="GOLD_LOAN" />
          </Field>
          <Field label="Label" required>
            <Input value={form.label} onChange={(e) => update({ label: e.target.value })} placeholder="Gold loan" />
          </Field>
        </FieldGrid>
        <FieldGrid>
          <Field label="Sort order" required>
            <IntegerInput value={form.sortOrder} onValueChange={(v) => update({ sortOrder: v })} min={0} max={999} />
          </Field>
          {editing && (
            <Field label="Status" hint="Inactive requirements can't be chosen for new leads.">
              <Switch label={form.isActive ? 'Active' : 'Inactive'} checked={form.isActive} onCheckedChange={(v) => update({ isActive: v })} />
            </Field>
          )}
        </FieldGrid>
      </FormSection>

      <FormSection title="Fields captured" description="Shown on the Add lead form in this order.">
        {form.fields.length === 0 && <p className="text-sm text-muted-foreground">No fields. Leads for this requirement have only the common lead fields.</p>}
        <ol className="space-y-3">
          {form.fields.map((row, index) => (
            <li key={row.id} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-label text-muted-foreground">Field {index + 1}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => update({ fields: move(form.fields, index, index - 1) })}><ArrowUp /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === form.fields.length - 1} onClick={() => update({ fields: move(form.fields, index, index + 1) })}><ArrowDown /></Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove field" className="text-danger" onClick={() => update({ fields: form.fields.filter((_, i) => i !== index) })}><Trash2 /></Button>
                </div>
              </div>
              <FieldGrid>
                <Field label="Label" required><Input value={row.label} onChange={(e) => updateField(index, { label: e.target.value, key: row.key || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') })} /></Field>
                <Field label="Key" required><Input className="id-mono" value={row.key} onChange={(e) => updateField(index, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="gold_weight_grams" /></Field>
                <Field label="Type" required><Select value={row.type} onValueChange={(v) => updateField(index, { type: v as FieldType })} options={FIELD_TYPE_OPTIONS} /></Field>
                <Field label="Role" optional><Select value={row.role} onValueChange={(v) => updateField(index, { role: v })} options={ROLE_OPTIONS} clearLabel="No role" placeholder="No role" /></Field>
              </FieldGrid>
              {row.type === 'text' && (
                <Field label="Pattern" optional hint="A regular expression the value must match." className="mt-4">
                  <Input className="id-mono" value={row.pattern} onChange={(e) => updateField(index, { pattern: e.target.value })} />
                </Field>
              )}
              {row.type === 'number' && (
                <FieldGrid className="mt-4">
                  <Field label="Minimum" optional><Input inputMode="decimal" className="num" value={row.min} onChange={(e) => updateField(index, { min: e.target.value.replace(/[^\d.-]/g, '') })} /></Field>
                  <Field label="Maximum" optional><Input inputMode="decimal" className="num" value={row.max} onChange={(e) => updateField(index, { max: e.target.value.replace(/[^\d.-]/g, '') })} /></Field>
                </FieldGrid>
              )}
              {row.type === 'select' && (
                <Field label="Options" required hint="Separate with commas." className="mt-4">
                  <Input value={row.options} onChange={(e) => updateField(index, { options: e.target.value })} placeholder="18K, 22K, 24K" />
                </Field>
              )}
              <Checkbox className="mt-3" label="Required" checked={row.required} onCheckedChange={(v) => updateField(index, { required: v })} />
            </li>
          ))}
        </ol>
        <Button variant="outline" size="sm" icon={Plus} onClick={() => update({ fields: [...form.fields, emptyField()] })}>Add field</Button>
      </FormSection>

      <FormSection title="Checks" description="Run in this order for every lead of this requirement.">
        {form.actions.length === 0 && <p className="text-sm text-muted-foreground">No checks. Leads for this requirement have no verification step.</p>}
        <ol className="space-y-2">
          {form.actions.map((code, index) => (
            <li key={`${code}-${index}`} className="flex items-center gap-2">
              <span className="num w-6 text-center text-caption text-muted-foreground">{index + 1}</span>
              <Select
                aria-label={`Check ${index + 1}`}
                value={code}
                onValueChange={(v) => update({ actions: form.actions.map((a, i) => (i === index ? v : a)) })}
                options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
                className="flex-1"
              />
              <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => update({ actions: move(form.actions, index, index - 1) })}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === form.actions.length - 1} onClick={() => update({ actions: move(form.actions, index, index + 1) })}><ArrowDown /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Remove check" className="text-danger" onClick={() => update({ actions: form.actions.filter((_, i) => i !== index) })}><Trash2 /></Button>
            </li>
          ))}
        </ol>
        <Button variant="outline" size="sm" icon={Plus} onClick={() => update({ actions: [...form.actions, Object.keys(ACTION_LABELS)[0]] })}>Add check</Button>
      </FormSection>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Financial requirements"
        count={data?.length}
        description="What a lead can be raised for, the details captured, and the checks that run."
        actions={<Button icon={Plus} data-new-record onClick={() => openEditor(null)}>Add requirement</Button>}
      />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search requirements…" />
      <DataTable
        label="Financial requirements"
        columns={columns}
        rows={list.filtered}
        getRowId={(p) => p.productTypeId}
        loading={loading}
        error={error}
        onRetry={refetch}
        onRowClick={(p) => openEditor(p)}
        isFiltered={list.isFiltered}
        onClearFilters={list.clear}
        empty={{ title: 'No financial requirements', description: 'Add one so leads can be raised for it.', action: <Button icon={Plus} onClick={() => openEditor(null)}>Add requirement</Button> }}
      />
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        variant="sheet"
        size={isWide ? '2xl' : 'xl'}
        title={editing ? `Edit ${editing.label}` : 'Add financial requirement'}
        dirty={dirty}
        error={serverError}
        onSubmit={() => void save()}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} loadingText="Saving…">{editing ? 'Save requirement' : 'Add requirement'}</Button>
          </>
        }
      >
        {isWide ? (
          <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6">
            {editor}
            <aside aria-label="Form preview" className="sticky top-0 self-start rounded-lg border bg-muted/40 p-4">
              <p className="mb-3 text-label text-muted-foreground">Preview on the Add lead form</p>
              {schema.length === 0 ? <p className="text-caption text-muted-foreground">Fields appear here as you add them.</p> : (
                <div className="space-y-3">
                  {schema.map((f) => (
                    <ProductFieldInput key={f.key} field={f} value={preview[f.key] ?? ''} onChange={(v) => setPreview((p) => ({ ...p, [f.key]: v }))} />
                  ))}
                </div>
              )}
            </aside>
          </div>
        ) : editor}
      </ResponsiveDialog>
    </>
  );
}

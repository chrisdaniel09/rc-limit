import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import {
  ACTION_LABELS,
  FIELD_TYPE_OPTIONS,
  ROLE_OPTIONS,
  type FieldType,
  type ProductField,
  type ProductType,
} from './productTypes';

interface FieldRow {
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

interface ActionRow {
  code: string;
  order: string;
}

interface ProductForm {
  code: string;
  label: string;
  sortOrder: string;
  isActive: boolean;
  fields: FieldRow[];
  actions: ActionRow[];
}

const emptyField = (): FieldRow => ({
  key: '', label: '', type: 'text', required: false, role: '', pattern: '', min: '', max: '', options: '',
});

const emptyAction = (order: number): ActionRow => ({ code: Object.keys(ACTION_LABELS)[0], order: String(order) });

const toFieldRow = (field: ProductField): FieldRow => ({
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
  if (row.type === 'number') {
    return {
      pattern: null,
      min: row.min === '' ? null : Number(row.min),
      max: row.max === '' ? null : Number(row.max),
      options: null,
    };
  }
  if (row.type === 'select') {
    const options = row.options.split(',').map((o) => o.trim()).filter(Boolean);
    return { pattern: null, min: null, max: null, options };
  }
  return null;
};

const toPayload = (form: ProductForm) => ({
  code: form.code,
  label: form.label.trim(),
  sortOrder: parseInt(form.sortOrder) || 0,
  isActive: form.isActive,
  fieldSchema: form.fields.map((row) => ({
    key: row.key.trim(),
    label: row.label.trim(),
    type: row.type,
    required: row.required,
    role: row.role || null,
    validation: toValidation(row),
  })),
  actions: form.actions.map((row) => ({ code: row.code, order: parseInt(row.order) || 0, config: {} })),
});

export default function ProductTypesPage() {
  const { data, loading, refetch } = useFetch<ProductType[]>('/api/v1/lead-product-types');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>({ code: '', label: '', sortOrder: '1', isActive: true, fields: [], actions: [] });

  const columns: Column<ProductType>[] = [
    { key: 'sortOrder', header: '#', render: (p) => <span className="text-gray-400">{p.sortOrder}</span> },
    { key: 'code', header: 'Code', render: (p) => <span className="font-mono text-xs">{p.code}</span> },
    { key: 'label', header: 'Financial Requirement' },
    { key: 'fieldSchema', header: 'Fields', render: (p) => p.fieldSchema.length },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => p.actions.length === 0
        ? <span className="text-gray-400">None</span>
        : p.actions.map((a) => ACTION_LABELS[a.code] ?? a.code).join(' → '),
    },
    { key: 'isActive', header: 'Status', render: (p) => <Badge text={p.isActive ? 'Active' : 'Inactive'} variant={p.isActive ? 'success' : 'neutral'} /> },
  ];

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setForm({
      code: '',
      label: '',
      sortOrder: String((data?.length ?? 0) + 1),
      isActive: true,
      fields: [],
      actions: [],
    });
    setShowModal(true);
  };

  const openEdit = (product: ProductType) => {
    setEditing(product);
    setError(null);
    setForm({
      code: product.code,
      label: product.label,
      sortOrder: String(product.sortOrder),
      isActive: product.isActive,
      fields: product.fieldSchema.map(toFieldRow),
      actions: product.actions
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((a) => ({ code: a.code, order: String(a.order) })),
    });
    setShowModal(true);
  };

  const updateField = (index: number, patch: Partial<FieldRow>) => {
    setForm({ ...form, fields: form.fields.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  };

  const updateAction = (index: number, patch: Partial<ActionRow>) => {
    setForm({ ...form, actions: form.actions.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = toPayload(form);
      if (editing) {
        const { code: _code, ...update } = payload;
        await apiPut(`/api/v1/lead-product-types/${editing.productTypeId}`, update);
      } else {
        await apiPost('/api/v1/lead-product-types', payload);
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      // The server explains which rule failed, so show its message.
      setError(err instanceof Error && err.message ? err.message : 'Could not save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Financial Requirements</h2>
          <p className="text-sm text-gray-500 mt-1">Define the financial requirements a lead can be raised for, the details captured for each, and the checks that run</p>
        </div>
        <button onClick={openCreate} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Requirement
        </button>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={loading} onRowClick={openEdit} searchPlaceholder="Search requirements..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Financial Requirement' : 'Add Financial Requirement'}>
        <form onSubmit={handleSubmit} className="space-y-1">
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {editing ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <p className="mt-1 text-sm font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">{form.code}</p>
            </div>
          ) : (
            <FormField label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase().replace(/\s+/g, '_') })} required placeholder="e.g. GOLD_LOAN" />
          )}
          <FormField label="Label" value={form.label} onChange={(v) => setForm({ ...form, label: v })} required placeholder="e.g. Gold Loan" />
          <FormField label="Sort Order" type="number" value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} required />
          {editing && (
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Active (inactive requirements can't be chosen for new leads)
            </label>
          )}

          <section className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Details captured</h3>
              <button type="button" onClick={() => setForm({ ...form, fields: [...form.fields, emptyField()] })} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">+ Add field</button>
            </div>
            {form.fields.length === 0 && <p className="mt-2 text-sm text-gray-500">No details. Leads of this requirement will only have the common lead fields.</p>}
            {form.fields.map((row, index) => (
              <div key={index} className="mt-3 rounded-md border border-gray-200 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Key" value={row.key} onChange={(v) => updateField(index, { key: v.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} required placeholder="e.g. gold_weight_grams" />
                  <FormField label="Label" value={row.label} onChange={(v) => updateField(index, { label: v })} required />
                  <FormField label="Type" value={row.type} onChange={(v) => updateField(index, { type: v as FieldType })} options={FIELD_TYPE_OPTIONS} required />
                  <FormField label="Role" value={row.role} onChange={(v) => updateField(index, { role: v })} options={ROLE_OPTIONS} />
                </div>
                {row.type === 'text' && (
                  <FormField label="Pattern (regular expression, optional)" value={row.pattern} onChange={(v) => updateField(index, { pattern: v })} />
                )}
                {row.type === 'number' && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Minimum" type="number" value={row.min} onChange={(v) => updateField(index, { min: v })} />
                    <FormField label="Maximum" type="number" value={row.max} onChange={(v) => updateField(index, { max: v })} />
                  </div>
                )}
                {row.type === 'select' && (
                  <FormField label="Options (comma separated)" value={row.options} onChange={(v) => updateField(index, { options: v })} required placeholder="e.g. 18K, 22K, 24K" />
                )}
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={row.required} onChange={(e) => updateField(index, { required: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    Required
                  </label>
                  <button type="button" onClick={() => setForm({ ...form, fields: form.fields.filter((_, i) => i !== index) })} className="text-sm text-red-600 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Checks run in order</h3>
              <button type="button" onClick={() => setForm({ ...form, actions: [...form.actions, emptyAction(form.actions.length + 1)] })} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">+ Add check</button>
            </div>
            {form.actions.length === 0 && <p className="mt-2 text-sm text-gray-500">No checks. Leads of this requirement won't have any verification step.</p>}
            {form.actions.map((row, index) => (
              <div key={index} className="mt-3 grid grid-cols-[1fr_6rem_auto] items-end gap-3">
                <FormField label="Check" value={row.code} onChange={(v) => updateAction(index, { code: v })} options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))} required />
                <FormField label="Order" type="number" value={row.order} onChange={(v) => updateAction(index, { order: v })} required />
                <button type="button" onClick={() => setForm({ ...form, actions: form.actions.filter((_, i) => i !== index) })} className="mb-4 text-sm text-red-600 hover:text-red-700">Remove</button>
              </div>
            ))}
          </section>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

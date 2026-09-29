import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface PostingRule {
  ruleId: string;
  particularType: string;
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  transactionType: string;
  description: string | null;
  isActive: boolean;
}

interface LedgerAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
}

interface ParticularType {
  particularTypeId: string;
  code: string;
  label: string;
  isActive: boolean;
}

const TRANSACTION_TYPES = [
  { value: 'BANK_DISBURSAL', label: 'Bank Disbursal' },
  { value: 'CUSTOMER_DISBURSAL', label: 'Customer Disbursal' },
  { value: 'FEE_DEDUCTION', label: 'Fee Deduction' },
  { value: 'COMMISSION_PAYOUT', label: 'Commission Payout' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
];

export default function PostingRulesPage() {
  const { data: rules, loading, refetch } = useFetch<PostingRule[]>('/api/v1/accounting/posting-rules');
  const { data: accounts } = useFetch<LedgerAccount[]>('/api/v1/accounting/accounts');
  const { data: particularTypes } = useFetch<ParticularType[]>('/api/v1/particular-types');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PostingRule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    particularType: '',
    debitAccountId: '',
    creditAccountId: '',
    transactionType: 'FEE_DEDUCTION',
    description: '',
    isActive: true,
  });

  const accountOptions = accounts?.map((a) => ({
    value: a.accountId,
    label: `${a.accountCode} — ${a.accountName}`,
  })) ?? [];

  const columns: Column<PostingRule>[] = [
    { key: 'particularType', header: 'Particular Type', render: (r) => <span className="font-mono text-xs">{r.particularType}</span> },
    { key: 'debitAccountCode', header: 'Debit Account', render: (r) => (
      <span title={r.debitAccountName} className="font-mono text-xs">{r.debitAccountCode}</span>
    )},
    { key: 'creditAccountCode', header: 'Credit Account', render: (r) => (
      <span title={r.creditAccountName} className="font-mono text-xs">{r.creditAccountCode}</span>
    )},
    { key: 'transactionType', header: 'Txn Type', render: (r) => <Badge text={r.transactionType} variant="info" /> },
    { key: 'description', header: 'Description', render: (r) => r.description ?? '-' },
    { key: 'isActive', header: 'Status', render: (r) => <Badge text={r.isActive ? 'Active' : 'Inactive'} variant={r.isActive ? 'success' : 'neutral'} /> },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({ particularType: '', debitAccountId: '', creditAccountId: '', transactionType: 'FEE_DEDUCTION', description: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (rule: PostingRule) => {
    setEditing(rule);
    setForm({
      particularType: rule.particularType,
      debitAccountId: rule.debitAccountId,
      creditAccountId: rule.creditAccountId,
      transactionType: rule.transactionType,
      description: rule.description ?? '',
      isActive: rule.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await apiPut(`/api/v1/accounting/posting-rules/${editing.ruleId}`, {
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          transactionType: form.transactionType,
          description: form.description || null,
          isActive: form.isActive,
        });
      } else {
        await apiPost('/api/v1/accounting/posting-rules', {
          particularType: form.particularType,
          debitAccountId: form.debitAccountId,
          creditAccountId: form.creditAccountId,
          transactionType: form.transactionType,
          description: form.description || null,
        });
      }
      setShowModal(false);
      refetch();
    } catch {
      // handle
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Posting Rules</h2>
          <p className="text-sm text-gray-500 mt-1">Map disbursal line item types to debit/credit accounts for automatic journal entries</p>
        </div>
        <button onClick={openCreate} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Rule
        </button>
      </div>

      <DataTable columns={columns} data={rules ?? []} loading={loading} onRowClick={openEdit} searchPlaceholder="Search rules..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Posting Rule' : 'Add Posting Rule'}>
        <form onSubmit={handleSubmit}>
          {editing ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Particular Type</label>
              <p className="mt-1 text-sm font-mono text-gray-900 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">{form.particularType}</p>
            </div>
          ) : (
            <FormField label="Particular Type" value={form.particularType} onChange={(v) => setForm({ ...form, particularType: v })} required options={
              (particularTypes ?? []).filter(t => t.isActive).map(t => ({ value: t.code, label: `${t.code} — ${t.label}` }))
            } />
          )}
          <FormField label="Debit Account" value={form.debitAccountId} onChange={(v) => setForm({ ...form, debitAccountId: v })} required options={accountOptions} />
          <FormField label="Credit Account" value={form.creditAccountId} onChange={(v) => setForm({ ...form, creditAccountId: v })} required options={accountOptions} />
          <FormField label="Transaction Type" value={form.transactionType} onChange={(v) => setForm({ ...form, transactionType: v })} required options={TRANSACTION_TYPES} />
          <FormField label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Explain what this rule does" />
          {editing && (
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Active
              </label>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

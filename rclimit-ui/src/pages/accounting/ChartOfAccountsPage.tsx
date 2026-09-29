import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface LedgerAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  currency: string;
  isActive: boolean;
}

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
];

const typeVariant = (t: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' => {
  switch (t) {
    case 'ASSET': return 'success';
    case 'LIABILITY': return 'danger';
    case 'EQUITY': return 'info';
    case 'INCOME': return 'success';
    case 'EXPENSE': return 'warning';
    default: return 'neutral';
  }
};

export default function ChartOfAccountsPage() {
  const { data, loading, refetch } = useFetch<LedgerAccount[]>('/api/v1/accounting/accounts');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ accountCode: '', accountName: '', accountType: 'ASSET' });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<LedgerAccount>[] = [
    { key: 'accountCode', header: 'Code' },
    { key: 'accountName', header: 'Account Name' },
    { key: 'accountType', header: 'Type', render: (a) => <Badge text={a.accountType} variant={typeVariant(a.accountType)} /> },
    { key: 'currency', header: 'Currency' },
    { key: 'isActive', header: 'Status', render: (a) => <Badge text={a.isActive ? 'Active' : 'Inactive'} variant={a.isActive ? 'success' : 'neutral'} /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/accounting/accounts', form);
      setShowModal(false);
      setForm({ accountCode: '', accountName: '', accountType: 'ASSET' });
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
        <h2 className="text-lg font-semibold text-gray-900">Chart of Accounts</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Account
        </button>
      </div>

      <DataTable columns={columns} data={data ?? []} loading={loading} searchPlaceholder="Search accounts..." />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Ledger Account">
        <form onSubmit={handleSubmit}>
          <FormField label="Account Code" value={form.accountCode} onChange={(v) => setForm({ ...form, accountCode: v })} required placeholder="e.g. 1010-CASH" />
          <FormField label="Account Name" value={form.accountName} onChange={(v) => setForm({ ...form, accountName: v })} required placeholder="e.g. Master Bank Settlement Account" />
          <FormField label="Account Type" value={form.accountType} onChange={(v) => setForm({ ...form, accountType: v })} required options={ACCOUNT_TYPES} />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

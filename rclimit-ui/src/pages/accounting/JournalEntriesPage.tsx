import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import Badge from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface LineItem {
  lineItemId: string;
  accountId: string;
  accountCode: string;
  entryDirection: string;
  amount: number;
}

interface JournalEntry {
  journalId: string;
  entryNumber: number;
  entryDate: string;
  transactionType: string;
  narration: string;
  createdAt: string;
  lineItems: LineItem[];
}

interface LedgerAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
}

interface FormLine {
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
}

const TRANSACTION_TYPES = [
  { value: 'MANUAL', label: 'Manual Entry' },
  { value: 'BANK_DISBURSAL', label: 'Bank Disbursal' },
  { value: 'CUSTOMER_DISBURSAL', label: 'Customer Disbursal' },
  { value: 'FEE_DEDUCTION', label: 'Fee Deduction' },
  { value: 'COMMISSION_PAYOUT', label: 'Commission Payout' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'REVERSAL', label: 'Reversal' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const emptyLine = (): FormLine => ({ accountId: '', direction: 'DEBIT', amount: '' });

export default function JournalEntriesPage() {
  const { data: entries, loading, refetch } = useFetch<JournalEntry[]>('/api/v1/accounting/journal-entries');
  const { data: accounts } = useFetch<LedgerAccount[]>('/api/v1/accounting/accounts');
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    transactionType: 'MANUAL',
    narration: '',
    lines: [emptyLine(), emptyLine()] as FormLine[],
  });

  const accountOptions = accounts?.map((a) => ({
    value: a.accountId,
    label: `${a.accountCode} — ${a.accountName}`,
  })) ?? [];

  const directionOptions = [
    { value: 'DEBIT', label: 'Debit' },
    { value: 'CREDIT', label: 'Credit' },
  ];

  const totalDebits = form.lines.filter((l) => l.direction === 'DEBIT').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredits = form.lines.filter((l) => l.direction === 'CREDIT').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const isBalanced = totalDebits > 0 && totalDebits === totalCredits;

  const updateLine = (idx: number, field: keyof FormLine, value: string) => {
    const updated = [...form.lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, lines: updated });
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, emptyLine()] });

  const removeLine = (idx: number) => {
    if (form.lines.length <= 2) return;
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return;
    setSubmitting(true);
    try {
      await apiPost('/api/v1/accounting/journal-entries', {
        referenceId: crypto.randomUUID(),
        transactionType: form.transactionType,
        narration: form.narration,
        postedByRole: 'ADMIN',
        sourceModule: 'MANUAL',
        lines: form.lines.map((l) => ({
          accountId: l.accountId,
          direction: l.direction,
          amount: parseFloat(l.amount),
        })),
      });
      setShowModal(false);
      setForm({ transactionType: 'MANUAL', narration: '', lines: [emptyLine(), emptyLine()] });
      refetch();
    } catch {
      // handle
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndOpen = () => {
    setForm({ transactionType: 'MANUAL', narration: '', lines: [emptyLine(), emptyLine()] });
    setShowModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Journal Entries</h2>
        <button onClick={resetAndOpen} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          New Journal Entry
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}
        </div>
      ) : !entries?.length ? (
        <p className="text-sm text-gray-500">No journal entries found.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.journalId} className="border border-gray-200 rounded-lg bg-white">
              <button
                onClick={() => setExpandedId(expandedId === entry.journalId ? null : entry.journalId)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-gray-500">#{entry.entryNumber}</span>
                  <Badge text={entry.transactionType} variant="info" />
                  <span className="text-sm text-gray-700">{entry.narration}</span>
                </div>
                <span className="text-xs text-gray-400">{formatDate(entry.createdAt)}</span>
              </button>

              {expandedId === entry.journalId && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="pb-2">Account</th>
                        <th className="pb-2 text-right">Debit</th>
                        <th className="pb-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entry.lineItems.map((li) => (
                        <tr key={li.lineItemId}>
                          <td className="py-1.5 font-mono text-gray-700">{li.accountCode}</td>
                          <td className="py-1.5 text-right text-gray-700">
                            {li.entryDirection === 'DEBIT' ? formatCurrency(li.amount) : ''}
                          </td>
                          <td className="py-1.5 text-right text-gray-700">
                            {li.entryDirection === 'CREDIT' ? formatCurrency(li.amount) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold border-t border-gray-200">
                        <td className="pt-2">Total</td>
                        <td className="pt-2 text-right">
                          {formatCurrency(entry.lineItems.filter((l) => l.entryDirection === 'DEBIT').reduce((s, l) => s + l.amount, 0))}
                        </td>
                        <td className="pt-2 text-right">
                          {formatCurrency(entry.lineItems.filter((l) => l.entryDirection === 'CREDIT').reduce((s, l) => s + l.amount, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-gray-400">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}</p>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Journal Entry">
        <form onSubmit={handleSubmit}>
          <FormField label="Transaction Type" value={form.transactionType} onChange={(v) => setForm({ ...form, transactionType: v })} required options={TRANSACTION_TYPES} />
          <FormField label="Narration" value={form.narration} onChange={(v) => setForm({ ...form, narration: v })} required placeholder="Describe the transaction..." />

          <div className="mt-4 mb-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Line Items</label>
              <button type="button" onClick={addLine} className="text-xs text-indigo-600 hover:text-indigo-800">+ Add Line</button>
            </div>

            <div className="space-y-2">
              {form.lines.map((line, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormField label={idx === 0 ? 'Account' : ''} value={line.accountId} onChange={(v) => updateLine(idx, 'accountId', v)} required options={accountOptions} />
                  </div>
                  <div className="w-28">
                    <FormField label={idx === 0 ? 'Direction' : ''} value={line.direction} onChange={(v) => updateLine(idx, 'direction', v)} required options={directionOptions} />
                  </div>
                  <div className="w-32">
                    <FormField label={idx === 0 ? 'Amount (₹)' : ''} type="number" value={line.amount} onChange={(v) => updateLine(idx, 'amount', v)} required placeholder="0.00" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={form.lines.length <= 2}
                    className="mb-4 text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm mt-3 px-1">
              <span>Debits: <span className="font-semibold">{formatCurrency(totalDebits)}</span></span>
              <span>Credits: <span className="font-semibold">{formatCurrency(totalCredits)}</span></span>
            </div>
            {totalDebits > 0 && !isBalanced && (
              <p className="text-xs text-red-600 mt-1">Debits must equal Credits to post.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting || !isBalanced} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Posting...' : 'Post Entry'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

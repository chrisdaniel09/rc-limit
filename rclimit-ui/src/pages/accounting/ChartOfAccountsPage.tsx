import { Fragment, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { apiPost } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import { FilterBar } from '@/components/FilterBar';
import StatusBadge from '@/components/StatusBadge';
import { CodeInput } from '@/components/inputs';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';

interface LedgerAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  currency: string;
  isActive: boolean;
}

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Assets' },
  { value: 'LIABILITY', label: 'Liabilities' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expenses' },
];

// Indent by code depth: 1000 → 0, 1100 → 1, 1110 → 2 (trailing zeros), or dotted codes 1.1.2.
function depthOf(code: string): number {
  if (code.includes('.')) return code.split('.').length - 1;
  const trimmed = code.replace(/0+$/, '');
  return Math.max(0, Math.min(3, trimmed.length - 1));
}

// §10.13 Chart of accounts as an indented tree grouped by account type.
export default function ChartOfAccountsPage() {
  const { data, loading, refetch } = useFetch<LedgerAccount[]>('/api/v1/accounting/accounts');
  const list = useClientFilter(data, (a) => [a.accountCode, a.accountName]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ accountCode: '', accountName: '', accountType: 'ASSET' });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ accountCode: '', accountName: '', accountType: 'ASSET' });
      setServerError(null);
    }
  }, [open]);

  const save = async () => {
    if (!form.accountCode || !form.accountName.trim()) {
      setServerError('Enter a code and a name.');
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/v1/accounting/accounts', form);
      notifySuccess('Account added');
      setOpen(false);
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, "The account wasn't added."));
    } finally {
      setSaving(false);
    }
  };

  const groups = ACCOUNT_TYPES.map((t) => ({
    ...t,
    accounts: (list.filtered ?? []).filter((a) => a.accountType === t.value).sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
  })).filter((g) => g.accounts.length > 0);

  return (
    <>
      <PageHeader title="Chart of accounts" count={data?.length} actions={<Button icon={Plus} data-new-record onClick={() => setOpen(true)}>Add account</Button>} />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search code or name…" />
      {loading && !data ? <Skeleton className="h-80 w-full" /> : groups.length === 0 ? (
        <EmptyState variant={list.isFiltered ? 'no-results' : 'no-data'} title={list.isFiltered ? 'No accounts match' : 'No accounts yet'} />
      ) : (
        <Card flush>
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-label text-muted-foreground">
              <tr>
                <th scope="col" className="h-10 px-cell font-medium">Account</th>
                <th scope="col" className="px-cell font-medium">Currency</th>
                <th scope="col" className="px-cell font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((g) => (
                <Fragment key={g.value}>
                  <tr className="bg-muted/40"><th scope="rowgroup" colSpan={3} className="h-9 px-cell text-left text-subheading">{g.label}</th></tr>
                  {g.accounts.map((a) => (
                    <tr key={a.accountId} className="h-row">
                      <td className="px-cell" style={{ paddingLeft: `calc(var(--cell-px) + ${depthOf(a.accountCode) * 20}px)` }}>
                        <span className="id-mono mr-3 text-muted-foreground">{a.accountCode}</span>
                        <span className="text-foreground">{a.accountName}</span>
                      </td>
                      <td className="px-cell text-muted-foreground">{a.currency}</td>
                      <td className="px-cell"><StatusBadge status={a.isActive ? 'ACTIVE' : 'INACTIVE'} inTable /></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        variant="sheet"
        title="Add account"
        error={serverError}
        onSubmit={() => void save()}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={saving} loadingText="Adding…">Add account</Button></>}
      >
        <div className="space-y-4">
          <Field label="Code" required><CodeInput value={form.accountCode} onValueChange={(v) => setForm((f) => ({ ...f, accountCode: v }))} placeholder="1100" autoFocus /></Field>
          <Field label="Name" required><Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} /></Field>
          <Field label="Type" required><Select value={form.accountType} onValueChange={(v) => setForm((f) => ({ ...f, accountType: v }))} options={ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label.replace(/s$/, '') }))} /></Field>
        </div>
      </ResponsiveDialog>
    </>
  );
}

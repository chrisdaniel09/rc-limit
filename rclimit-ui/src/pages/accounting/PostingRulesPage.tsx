import { useEffect, useState } from 'react';
import { ArrowRight, Edit3, Plus } from 'lucide-react';
import { apiPost, apiPut } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import StatusBadge from '@/components/StatusBadge';
import Badge from '@/components/Badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/layouts/templates';
import { humanize } from '@/lib/format';

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

interface LedgerAccount { accountId: string; accountCode: string; accountName: string; accountType: string }
interface ParticularType { particularTypeId: string; code: string; label: string; isActive: boolean }

const TRANSACTION_TYPES = ['BANK_DISBURSAL', 'CUSTOMER_DISBURSAL', 'FEE_DEDUCTION', 'COMMISSION_PAYOUT', 'ADJUSTMENT'].map((v) => ({ value: v, label: humanize(v) }));

// §10.13 Posting rules: which accounts each line item type posts to.
export default function PostingRulesPage() {
  const { data: rules, loading, error, refetch } = useFetch<PostingRule[]>('/api/v1/accounting/posting-rules');
  const { data: accounts } = useFetch<LedgerAccount[]>('/api/v1/accounting/accounts');
  const { data: particularTypes } = useFetch<ParticularType[]>('/api/v1/particular-types');
  const list = useClientFilter(rules, (r) => [r.particularType, r.debitAccountCode, r.creditAccountCode, r.description]);
  const [editor, setEditor] = useState<{ open: boolean; rule: PostingRule | null }>({ open: false, rule: null });
  const [form, setForm] = useState({ particularType: '', debitAccountId: '', creditAccountId: '', transactionType: 'FEE_DEDUCTION', description: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor.open) return;
    const r = editor.rule;
    setForm(r
      ? { particularType: r.particularType, debitAccountId: r.debitAccountId, creditAccountId: r.creditAccountId, transactionType: r.transactionType, description: r.description ?? '', isActive: r.isActive }
      : { particularType: '', debitAccountId: '', creditAccountId: '', transactionType: 'FEE_DEDUCTION', description: '', isActive: true });
    setServerError(null);
  }, [editor]);

  const accountOptions = (accounts ?? []).map((a) => ({ value: a.accountId, label: `${a.accountCode} — ${a.accountName}`, secondary: humanize(a.accountType) }));
  const particularLabel = (code: string) => particularTypes?.find((p) => p.code === code)?.label ?? humanize(code);

  const save = async () => {
    if ((!editor.rule && !form.particularType) || !form.debitAccountId || !form.creditAccountId) {
      setServerError('Choose the line item type and both accounts.');
      return;
    }
    if (form.debitAccountId === form.creditAccountId) {
      setServerError('Debit and credit accounts must differ.');
      return;
    }
    setSaving(true);
    setServerError(null);
    const body = { debitAccountId: form.debitAccountId, creditAccountId: form.creditAccountId, transactionType: form.transactionType, description: form.description || null };
    try {
      if (editor.rule) await apiPut(`/api/v1/accounting/posting-rules/${editor.rule.ruleId}`, { ...body, isActive: form.isActive });
      else await apiPost('/api/v1/accounting/posting-rules', { ...body, particularType: form.particularType });
      notifySuccess(editor.rule ? 'Posting rule saved' : 'Posting rule added');
      setEditor({ open: false, rule: null });
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, "The posting rule wasn't saved."));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<PostingRule>[] = [
    { id: 'type', header: 'Line item type', mobile: 'title', cell: (r) => particularLabel(r.particularType) },
    {
      id: 'posting', header: 'Debit → credit', mobile: 'subtitle',
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <Tooltip content={r.debitAccountName}><span className="id-mono" tabIndex={0}>{r.debitAccountCode}</span></Tooltip>
          <ArrowRight aria-label="to" className="size-3.5 text-muted-foreground" />
          <Tooltip content={r.creditAccountName}><span className="id-mono" tabIndex={0}>{r.creditAccountCode}</span></Tooltip>
        </span>
      ),
    },
    { id: 'txn', header: 'Transaction type', mobile: 'meta', cell: (r) => <Badge text={humanize(r.transactionType)} variant="info" /> },
    { id: 'desc', header: 'Description', priority: 2, mobile: 'hidden', cell: (r) => <span className="block max-w-64 truncate text-muted-foreground">{r.description ?? '—'}</span> },
    { id: 'status', header: 'Status', kind: 'status', mobile: 'badge', cell: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} inTable /> },
  ];

  return (
    <>
      <PageHeader
        title="Posting rules"
        count={rules?.length}
        description="Which accounts each line item type posts to."
        actions={<Button icon={Plus} data-new-record onClick={() => setEditor({ open: true, rule: null })}>Add rule</Button>}
      />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search rules…" />
      <DataTable
        label="Posting rules"
        columns={columns}
        rows={list.filtered}
        getRowId={(r) => r.ruleId}
        loading={loading}
        error={error}
        onRetry={refetch}
        isFiltered={list.isFiltered}
        onClearFilters={list.clear}
        rowActions={(r) => [{ label: 'Edit', icon: Edit3, onSelect: () => setEditor({ open: true, rule: r }) }]}
        empty={{ title: 'No posting rules yet', action: <Button icon={Plus} onClick={() => setEditor({ open: true, rule: null })}>Add rule</Button> }}
      />
      <ResponsiveDialog
        open={editor.open}
        onOpenChange={(o) => setEditor((e) => ({ ...e, open: o }))}
        variant="sheet"
        title={editor.rule ? 'Edit posting rule' : 'Add posting rule'}
        error={serverError}
        onSubmit={() => void save()}
        footer={<><Button variant="outline" onClick={() => setEditor((e) => ({ ...e, open: false }))}>Cancel</Button><Button type="submit" loading={saving} loadingText="Saving…">{editor.rule ? 'Save rule' : 'Add rule'}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Line item type" required>
            {editor.rule
              ? <Input value={particularLabel(form.particularType)} readOnly />
              : <Select value={form.particularType} onValueChange={(v) => setForm((f) => ({ ...f, particularType: v }))} options={(particularTypes ?? []).filter((p) => p.isActive).map((p) => ({ value: p.code, label: p.label }))} />}
          </Field>
          <Field label="Debit account" required><Combobox value={form.debitAccountId} onValueChange={(v) => setForm((f) => ({ ...f, debitAccountId: v }))} options={accountOptions} placeholder="Choose an account" /></Field>
          <Field label="Credit account" required><Combobox value={form.creditAccountId} onValueChange={(v) => setForm((f) => ({ ...f, creditAccountId: v }))} options={accountOptions} placeholder="Choose an account" /></Field>
          <Field label="Transaction type" required><Select value={form.transactionType} onValueChange={(v) => setForm((f) => ({ ...f, transactionType: v }))} options={TRANSACTION_TYPES} /></Field>
          <Field label="Description" optional><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          {editor.rule && <Switch label="Active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />}
        </div>
      </ResponsiveDialog>
    </>
  );
}

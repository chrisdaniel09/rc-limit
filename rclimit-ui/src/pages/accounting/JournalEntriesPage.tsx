import { Fragment, useEffect, useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { apiPost } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import { FilterBar } from '@/components/FilterBar';
import Badge from '@/components/Badge';
import { CurrencyInput } from '@/components/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field, FieldGrid } from '@/components/ui/field';
import { Card, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import { cn } from '@/lib/cn';
import { formatDate, formatINR, humanize } from '@/lib/format';

interface LineItem { lineItemId: string; accountId: string; accountCode: string; entryDirection: string; amount: number }
interface JournalEntry { journalId: string; entryNumber: number; entryDate: string; transactionType: string; narration: string; createdAt: string; lineItems: LineItem[] }
interface LedgerAccount { accountId: string; accountCode: string; accountName: string; accountType: string }
interface FormLine { id: string; accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: number | null }

const TRANSACTION_TYPES = ['MANUAL', 'BANK_DISBURSAL', 'CUSTOMER_DISBURSAL', 'FEE_DEDUCTION', 'COMMISSION_PAYOUT', 'ADJUSTMENT', 'REVERSAL'].map((v) => ({ value: v, label: humanize(v) }));
const emptyLine = (direction: 'DEBIT' | 'CREDIT' = 'DEBIT'): FormLine => ({ id: crypto.randomUUID(), accountId: '', direction, amount: null });

const sum = (lines: LineItem[], dir: string) => lines.filter((l) => l.entryDirection === dir).reduce((s, l) => s + l.amount, 0);

// §10.13 Journal entries: expandable balanced debit/credit lines per entry.
export default function JournalEntriesPage() {
  const { data: entries, loading, refetch } = useFetch<JournalEntry[]>('/api/v1/accounting/journal-entries');
  const { data: accounts } = useFetch<LedgerAccount[]>('/api/v1/accounting/accounts');
  const list = useClientFilter(entries, (e) => [String(e.entryNumber), e.narration, e.transactionType]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ transactionType: 'MANUAL', narration: '', lines: [emptyLine('DEBIT'), emptyLine('CREDIT')] });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({ transactionType: 'MANUAL', narration: '', lines: [emptyLine('DEBIT'), emptyLine('CREDIT')] });
      setServerError(null);
    }
  }, [open]);

  const accountOptions = (accounts ?? []).map((a) => ({ value: a.accountId, label: `${a.accountCode} — ${a.accountName}`, secondary: humanize(a.accountType) }));
  const debits = form.lines.filter((l) => l.direction === 'DEBIT').reduce((s, l) => s + (l.amount ?? 0), 0);
  const credits = form.lines.filter((l) => l.direction === 'CREDIT').reduce((s, l) => s + (l.amount ?? 0), 0);
  const balanced = debits > 0 && Math.abs(debits - credits) < 0.005;
  const complete = form.lines.every((l) => l.accountId && l.amount);
  const setLine = (id: string, patch: Partial<FormLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const save = async () => {
    if (!complete || !balanced || !form.narration.trim()) {
      setServerError(!form.narration.trim() ? 'Enter a narration.' : !complete ? 'Choose an account and amount on every line.' : 'Debits and credits must be equal.');
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      await apiPost('/api/v1/accounting/journal-entries', {
        referenceId: crypto.randomUUID(),
        transactionType: form.transactionType,
        narration: form.narration.trim(),
        postedByRole: 'ADMIN',
        sourceModule: 'MANUAL',
        lines: form.lines.map((l) => ({ accountId: l.accountId, direction: l.direction, amount: l.amount })),
      });
      notifySuccess('Journal entry posted');
      setOpen(false);
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, "The journal entry wasn't posted."));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const rows = list.filtered ?? [];

  return (
    <>
      <PageHeader title="Journal entries" count={entries?.length} actions={<Button icon={Plus} data-new-record onClick={() => setOpen(true)}>New journal entry</Button>} />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search entry #, narration…" />
      {loading && !entries ? <Skeleton className="h-80 w-full" /> : rows.length === 0 ? (
        <EmptyState variant={list.isFiltered ? 'no-results' : 'no-data'} title={list.isFiltered ? 'No entries match' : 'No journal entries yet'} />
      ) : (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-label text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  <th scope="col" className="h-10 px-cell font-medium">Entry</th>
                  <th scope="col" className="px-cell font-medium">Date</th>
                  <th scope="col" className="px-cell font-medium">Type</th>
                  <th scope="col" className="px-cell font-medium">Narration</th>
                  <th scope="col" className="px-cell text-right font-medium">Debit</th>
                  <th scope="col" className="px-cell text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((e) => {
                  const isOpen = expanded.has(e.journalId);
                  return (
                    <Fragment key={e.journalId}>
                      <tr className={cn('h-row hover:bg-muted/40', isOpen && 'bg-muted/40')}>
                        <td className="pl-2">
                          <button type="button" aria-expanded={isOpen} aria-label={isOpen ? 'Hide lines' : 'Show lines'} onClick={() => toggle(e.journalId)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted">
                            <ChevronRight className={cn('size-4 transition-transform', isOpen && 'rotate-90')} />
                          </button>
                        </td>
                        <td className="num px-cell font-medium">#{e.entryNumber}</td>
                        <td className="num whitespace-nowrap px-cell">{formatDate(e.entryDate)}</td>
                        <td className="px-cell"><Badge text={humanize(e.transactionType)} variant="info" /></td>
                        <td className="max-w-80 truncate px-cell text-muted-foreground">{e.narration}</td>
                        <td className="num whitespace-nowrap px-cell text-right">{formatINR(sum(e.lineItems, 'DEBIT'))}</td>
                        <td className="num whitespace-nowrap px-cell text-right">{formatINR(sum(e.lineItems, 'CREDIT'))}</td>
                      </tr>
                      {isOpen && e.lineItems.map((li) => (
                        <tr key={li.lineItemId} className="h-9 bg-muted/20 text-caption">
                          <td />
                          <td colSpan={4} className={cn('px-cell', li.entryDirection === 'CREDIT' && 'pl-12')}>
                            <span className="id-mono">{li.accountCode}</span>{' '}
                            <span className="text-muted-foreground">{accounts?.find((a) => a.accountId === li.accountId)?.accountName}</span>
                          </td>
                          <td className="num px-cell text-right">{li.entryDirection === 'DEBIT' ? formatINR(li.amount) : ''}</td>
                          <td className="num px-cell text-right">{li.entryDirection === 'CREDIT' ? formatINR(li.amount) : ''}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="New journal entry"
        size="xl"
        dirty={!!form.narration || form.lines.some((l) => l.accountId || l.amount)}
        error={serverError}
        onSubmit={() => void save()}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={saving} loadingText="Posting…" disabledReason={!balanced ? 'Debits and credits must be equal.' : undefined}>Post entry</Button></>}
      >
        <div className="space-y-4">
          <FieldGrid>
            <Field label="Transaction type" required><Select value={form.transactionType} onValueChange={(v) => setForm((f) => ({ ...f, transactionType: v }))} options={TRANSACTION_TYPES} /></Field>
            <Field label="Narration" required><Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} /></Field>
          </FieldGrid>
          <div className="space-y-2">
            <p className="text-label text-foreground">Lines</p>
            {form.lines.map((l, i) => (
              <div key={l.id} className="grid grid-cols-1 items-start gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto_10rem_auto] md:border-0 md:p-0">
                <Combobox aria-label={`Line ${i + 1} account`} value={l.accountId} onValueChange={(v) => setLine(l.id, { accountId: v })} options={accountOptions} placeholder="Choose an account" />
                <Segmented aria-label={`Line ${i + 1} direction`} value={l.direction} onValueChange={(v) => setLine(l.id, { direction: v })} options={[{ value: 'DEBIT', label: 'Debit' }, { value: 'CREDIT', label: 'Credit' }]} />
                <CurrencyInput aria-label={`Line ${i + 1} amount`} value={l.amount} onValueChange={(v) => setLine(l.id, { amount: v })} />
                <Button variant="ghost" size="icon" aria-label={`Remove line ${i + 1}`} disabled={form.lines.length <= 2} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== l.id) }))}><Trash2 /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" icon={Plus} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>Add line</Button>
          </div>
          <Alert tone={balanced ? 'success' : 'warning'}>
            <span className="num">Debits {formatINR(debits)} · Credits {formatINR(credits)}</span>
            {!balanced && debits + credits > 0 && <span className="num"> · difference {formatINR(Math.abs(debits - credits))}</span>}
          </Alert>
        </div>
      </ResponsiveDialog>
    </>
  );
}

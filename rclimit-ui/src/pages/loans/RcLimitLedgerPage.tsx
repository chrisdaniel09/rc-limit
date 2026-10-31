import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Info } from 'lucide-react';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useListState } from '@/hooks/useListState';
import { useTerms } from '@/theme/ThemeProvider';
import { FilterBar, type FilterDef } from '@/components/FilterBar';
import LedgerTable, { type LedgerRow } from '@/components/LedgerTable';
import { MetricCard, MetricStrip } from '@/components/metrics';
import Pagination from '@/components/Pagination';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { Card } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/layouts/templates';
import { downloadCsv } from '@/lib/download';
import { formatINR, humanize } from '@/lib/format';
import { searchCustomers } from '@/lib/lookups';
import type { MasterOption } from './loanTypes';

interface RcLedgerRowDto {
  lineItemId: string;
  loanId: string;
  entryDate: string;
  applicationNumber: string;
  customerName: string;
  vehicleRegNo: string;
  lenderName: string;
  loanStatus: string;
  entryDirection: 'CREDIT' | 'DEBIT';
  counterparty: string;
  particularType: string;
  creditAmount: number | null;
  debitAmount: number | null;
  runningBalanceAmt: number;
}

interface BankPool { poolId: string; lenderName: string; facilityAccountNumber: string }

const INITIAL_FILTERS = { customerId: '', poolId: '', startDate: '', endDate: '', hasOpenBalance: '', hideDirectCustomerCredits: '' };

// §10.9 RC limit ledger: ledger entries across loans.
export default function RcLimitLedgerPage() {
  const navigate = useNavigate();
  const terms = useTerms();
  const list = useListState({ storageKey: 'rcLedger.pageSize', defaultSortBy: 'entryDate', defaultSortDir: 'asc', initialFilters: INITIAL_FILTERS });
  const { data: rows, meta, loading, error, refetch } = useFetch<RcLedgerRowDto[]>(`/api/v1/loans/rc-limit-ledger?${list.query}`, [], { staleAfter: LIST_STALE_MS });
  const { data: pools } = useFetch<BankPool[]>('/api/v1/bank-pools');
  const { data: counterparties } = useFetch<MasterOption[]>('/api/v1/lender-disbursed-to-options');
  const { data: particularTypes } = useFetch<MasterOption[]>('/api/v1/particular-types');
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});

  const filters: FilterDef[] = [
    {
      key: 'customerId', label: 'Customer', type: 'combobox',
      search: async (t) => {
        const hits = await searchCustomers(t);
        setCustomerNames((m) => ({ ...m, ...Object.fromEntries(hits.map((h) => [h.value, h.label])) }));
        return hits;
      },
      selectedLabel: (v) => customerNames[v],
    },
    { key: 'poolId', label: 'Bank pool', type: 'combobox', options: (pools ?? []).map((p) => ({ value: p.poolId, label: `${p.lenderName} — ${p.facilityAccountNumber}` })) },
    { key: 'date', label: 'Date', type: 'dateRange', from: 'startDate', to: 'endDate' },
    { key: 'hasOpenBalance', label: 'Balance', type: 'single', options: [{ value: 'true', label: 'Open balance' }, { value: 'false', label: 'Settled' }] },
  ];

  const ledgerRows: LedgerRow[] = useMemo(() => (rows ?? []).map((r) => ({
    id: r.lineItemId,
    date: r.entryDate,
    direction: r.entryDirection,
    counterparty: r.counterparty,
    particular: r.entryDirection === 'DEBIT' ? r.particularType : null,
    credit: r.creditAmount,
    debit: r.debitAmount,
    balance: r.runningBalanceAmt,
    balanceUnchanged: r.entryDirection === 'CREDIT' && r.counterparty !== terms.brokerCounterpartyCode,
    loan: { loanId: r.loanId, applicationNumber: r.applicationNumber, customerName: r.customerName, vehicleRegNo: r.vehicleRegNo, lenderName: r.lenderName, loanStatus: r.loanStatus },
  })), [rows, terms.brokerCounterpartyCode]);

  // Totals over the whole filter when the API sends them; otherwise over the rows shown.
  const shown = ledgerRows.reduce((t, r) => ({ credit: t.credit + (r.credit ?? 0), debit: t.debit + (r.debit ?? 0) }), { credit: 0, debit: 0 });
  const credit = meta?.totals?.credit ?? shown.credit;
  const debit = meta?.totals?.debit ?? shown.debit;
  const entries = meta?.totalCount ?? ledgerRows.length;
  const hide = list.filters.hideDirectCustomerCredits === 'true';

  return (
    <>
      <PageHeader title="RC limit ledger" description="Ledger entries across loans, with each loan's running balance." />
      <FilterBar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search application #, customer…"
        filters={filters}
        values={list.filters}
        onChange={(c) => list.setFilters(c as Partial<typeof INITIAL_FILTERS>)}
        onClearAll={list.clearFilters}
        resultCount={entries}
        resultLabel="entries"
        actions={
          <>
            <span className="flex items-center gap-1">
              <Switch
                label="Hide direct customer credits"
                checked={hide}
                onCheckedChange={(on) => list.updateFilter('hideDirectCustomerCredits', on ? 'true' : '')}
              />
              <Tooltip content="Bank credits paid straight to the customer. Hiding them changes the rows shown, not the running balances.">
                <button type="button" aria-label="About direct customer credits" className="text-muted-foreground"><Info className="size-4" /></button>
              </Tooltip>
            </span>
            <Button variant="outline" size="sm" icon={Download} className="h-8" onClick={() => void downloadCsv(`/api/v1/loans/rc-limit-ledger/export?${list.query}`, 'rc-limit-ledger.csv')}>
              Export
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <MetricStrip columns={4}>
          <MetricCard label="Credits shown" value={formatINR(credit, { whole: true })} context={formatINR(credit)} contextTone="success" />
          <MetricCard label="Debits shown" value={formatINR(debit, { whole: true })} context={formatINR(debit)} contextTone="danger" />
          <MetricCard label="Net" value={formatINR(credit - debit, { whole: true })} context={formatINR(credit - debit)} />
          <MetricCard label="Entries" value={entries.toLocaleString('en-IN')} />
        </MetricStrip>
      </div>

      {error ? (
        <Alert tone="danger" title="The ledger didn't load" action={<Button variant="outline" size="sm" onClick={refetch}>Retry</Button>}>{error}</Alert>
      ) : (
        <Card flush>
          <LedgerTable
            rows={ledgerRows}
            loading={loading}
            crossLoan
            closingBalance={null}
            counterpartyLabel={(c) => counterparties?.find((o) => o.code === c)?.label ?? humanize(c)}
            particularLabel={(c) => particularTypes?.find((o) => o.code === c)?.label ?? humanize(c)}
            emptyTitle={list.isFiltered ? 'No entries match these filters' : 'No ledger entries yet'}
            emptyAction={list.isFiltered ? <Button variant="outline" onClick={list.clearFilters}>Clear filters</Button> : undefined}
            onOpenLoan={(loanId) => navigate(`/loans/${loanId}`)}
          />
        </Card>
      )}
      {meta && (
        <div className="mt-3">
          <Pagination meta={meta} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} loading={loading} />
        </div>
      )}
    </>
  );
}

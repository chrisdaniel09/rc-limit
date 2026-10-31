import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Columns2, Download, Plus } from 'lucide-react';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useListState } from '@/hooks/useListState';
import { useTerms } from '@/theme/ThemeProvider';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar, SavedViews, type FilterDef } from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/choice';
import { Empty } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/layouts/templates';
import { SplitView, useSplitPreference } from '@/layouts/SplitView';
import { formatDate, formatDays, formatINR, formatRegNo } from '@/lib/format';
import { getStatus, TONE_TEXT } from '@/lib/status';
import { searchCustomers, searchPartners } from '@/lib/lookups';
import { downloadCsv } from '@/lib/download';
import { cn } from '@/lib/cn';
import CreateLoanDialog from './CreateLoanDialog';
import { LoanDetailView } from './LoanDetailPage';
import { LOAN_STATUS_OPTIONS, PRODUCT_TYPES, RC_AGING_OPTIONS, type LoanListItem } from './loanTypes';

const INITIAL_FILTERS = {
  loanStatus: '', lenderId: '', poolId: '', productType: '', partnerId: '', customerId: '',
  disbursedFrom: '', disbursedTo: '', rcAging: '', hasOpenBalance: '',
};

interface Lender { lenderId: string; name: string }
interface BankPool { poolId: string; lenderName: string; facilityAccountNumber: string }

// §10.7 Loans list.
export default function LoansPage() {
  const list = useListState({ storageKey: 'loans.pageSize', defaultSortBy: 'createdAt', defaultSortDir: 'desc', initialFilters: INITIAL_FILTERS });
  const { data, meta, loading, error, refetch } = useFetch<LoanListItem[]>(`/api/v1/loans?${list.query}`, [], { staleAfter: LIST_STALE_MS });
  const { data: lenders } = useFetch<Lender[]>('/api/v1/lenders');
  const { data: pools } = useFetch<BankPool[]>('/api/v1/bank-pools');
  const terms = useTerms();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const split = useSplitPreference('loans', false);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [partnerNames, setPartnerNames] = useState<Record<string, string>>({});

  // ?new=1 (command palette, shortcuts) opens the create dialog.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateOpen(true);
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filters: FilterDef[] = useMemo(() => [
    { key: 'loanStatus', label: 'Status', type: 'multi', options: LOAN_STATUS_OPTIONS },
    { key: 'lenderId', label: 'Lender', type: 'single', options: (lenders ?? []).map((l) => ({ value: l.lenderId, label: l.name })) },
    { key: 'poolId', label: 'Bank pool', type: 'combobox', options: (pools ?? []).map((p) => ({ value: p.poolId, label: `${p.lenderName} — ${p.facilityAccountNumber}` })) },
    { key: 'productType', label: 'Product', type: 'single', options: PRODUCT_TYPES },
    {
      key: 'customerId', label: 'Customer', type: 'combobox',
      search: async (t) => {
        const hits = await searchCustomers(t);
        setCustomerNames((m) => ({ ...m, ...Object.fromEntries(hits.map((h) => [h.value, h.label])) }));
        return hits;
      },
      selectedLabel: (v) => customerNames[v],
    },
    {
      key: 'partnerId', label: 'Partner', type: 'combobox',
      search: async (t) => {
        const hits = await searchPartners(t);
        setPartnerNames((m) => ({ ...m, ...Object.fromEntries(hits.map((h) => [h.value, h.label])) }));
        return hits;
      },
      selectedLabel: (v) => partnerNames[v],
    },
    { key: 'disbursed', label: 'Disbursed', type: 'dateRange', from: 'disbursedFrom', to: 'disbursedTo' },
    { key: 'rcAging', label: 'RC aging', type: 'single', options: RC_AGING_OPTIONS },
    { key: 'hasOpenBalance', label: 'Balance', type: 'boolean', trueLabel: `Open ${terms.brokerLedgerName.toLowerCase()}` },
  ], [lenders, pools, customerNames, partnerNames, terms.brokerLedgerName]);

  const totals = meta?.totals;
  const columns: ColumnDef<LoanListItem>[] = [
    { id: 'applicationNumber', header: 'Application #', sortKey: 'applicationNumber', kind: 'id', mobile: 'title', cell: (l) => <span className="id-mono">{l.applicationNumber}</span> },
    { id: 'customer', header: 'Customer', sortKey: 'customerName', mobile: 'subtitle', cell: (l) => <span className="block max-w-56 truncate">{l.customerName}</span> },
    { id: 'vehicle', header: 'Vehicle', kind: 'id', mobile: 'subtitle', priority: split.enabled ? 3 : 2, hideable: true, cell: (l) => formatRegNo(l.vehicleRegNo) },
    { id: 'lender', header: 'Lender', priority: 2, hideable: true, mobile: 'hidden', cell: (l) => l.lenderName },
    { id: 'requested', header: 'Requested', sortKey: 'requestedAmount', kind: 'currency', priority: 3, hideable: true, mobile: 'hidden', cell: (l) => formatINR(l.requestedAmount, { whole: true }), total: totals ? formatINR(totals.requestedAmount, { whole: true }) : undefined },
    { id: 'sanctioned', header: 'Sanctioned', sortKey: 'sanctionedAmount', kind: 'currency', mobile: 'meta', cell: (l) => (l.sanctionedAmount == null ? <Empty /> : formatINR(l.sanctionedAmount, { whole: true })), total: totals ? formatINR(totals.sanctionedAmount, { whole: true }) : undefined },
    { id: 'balance', header: terms.brokerLedgerName, sortKey: 'netDisbursedAmount', kind: 'currency', mobile: 'meta', priority: split.enabled ? 3 : 1, cell: (l) => formatINR(l.netDisbursedAmount, { whole: true }), total: totals ? formatINR(totals.netDisbursedAmount, { whole: true }) : undefined },
    { id: 'status', header: 'Status', sortKey: 'loanStatus', kind: 'status', mobile: 'badge', cell: (l) => <StatusBadge status={l.loanStatus} domain="loan" inTable /> },
    {
      id: 'rcAging', header: 'RC aging', kind: 'number', priority: 2, hideable: true, mobile: 'meta',
      cell: (l) => {
        if (l.rcAgingDays == null || !l.disbursalDate) return <Empty />;
        const tone = getStatus(l.rcAgingStatus).tone;
        return <span className={cn('num', l.rcAgingStatus ? TONE_TEXT[tone] : 'text-foreground')}>{formatDays(l.rcAgingDays)}</span>;
      },
    },
    { id: 'disbursed', header: 'Disbursed', sortKey: 'disbursalDate', kind: 'date', priority: 3, hideable: true, mobile: 'hidden', cell: (l) => formatDate(l.disbursalDate) },
  ];

  const visibleColumns = split.enabled ? columns.filter((c) => ['applicationNumber', 'customer', 'balance', 'status'].includes(c.id)) : columns;

  const exportCsv = () => downloadCsv(`/api/v1/loans/export?${list.query}`, 'loans.csv');

  const table = (
    <>
      <FilterBar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search application #, customer, vehicle…"
        filters={filters}
        values={list.filters}
        onChange={(c) => list.setFilters(c as Partial<typeof INITIAL_FILTERS>)}
        onClearAll={list.clearFilters}
        resultCount={meta?.totalCount}
        resultLabel="loans"
        savedViews={!split.enabled && (
          <SavedViews
            storageKey="loans"
            defaults={[
              { id: 'overdue-rc', name: 'Overdue RCs', filters: { rcAging: 'OVERDUE_LOCK' }, sort: 'disbursalDate', dir: 'asc' },
              { id: 'in-flight', name: 'In flight', filters: { loanStatus: 'LOGGED_IN,CREDIT_REVIEW,SANCTIONED' } },
            ]}
            current={{ q: list.search, sort: list.sortBy, dir: list.sortDir, filters: list.filters }}
            onApply={(v) => list.applyView({ q: v.q, sort: v.sort, dir: v.dir, filters: v.filters as Partial<typeof INITIAL_FILTERS> })}
          />
        )}
        actions={!split.enabled && (
          <Tooltip content="Export the current filter as CSV">
            <Button variant="outline" size="sm" icon={Download} className="h-8" onClick={exportCsv}>Export</Button>
          </Tooltip>
        )}
      />
      <DataTable
        label="Loans"
        columns={visibleColumns}
        rows={data}
        getRowId={(l) => l.loanId}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowHref={(l) => `/loans/${l.loanId}`}
        onRowClick={split.enabled ? (l) => list.setSelectedId(l.loanId) : undefined}
        onMove={split.enabled ? (l) => list.setSelectedId(l.loanId) : undefined}
        selectedId={split.enabled ? list.selectedId : undefined}
        rowAttention={(l) => l.rcAgingStatus === 'OVERDUE_LOCK'}
        sort={{ sortBy: list.sortBy, sortDir: list.sortDir, onSort: list.updateSort, onSortChange: list.setSort }}
        isFiltered={list.isFiltered}
        onClearFilters={list.clearFilters}
        columnsKey={split.enabled ? undefined : 'loans'}
        accumulate={{ page: list.page, viewKey: list.viewKey }}
        empty={{
          title: 'No loans yet',
          description: 'Create a loan file to start tracking it through sanction, disbursal and RC.',
          action: <Button icon={Plus} onClick={() => setCreateOpen(true)}>Create loan</Button>,
        }}
        footer={<Pagination meta={meta} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} loading={loading} />}
      />
    </>
  );

  return (
    <>
      {split.enabled ? (
        <SplitView
          storageKey="loans"
          onClose={() => list.setSelectedId(null)}
          fullPageHref={list.selectedId ? `/loans/${list.selectedId}` : null}
          list={
            <>
              <PageHeader
                title="Loans"
                count={meta?.totalCount}
                actions={
                  <>
                    <Switch label={<Columns2 aria-label="Split view" className="size-4" />} checked onCheckedChange={() => split.setPreference(false)} />
                    <Button icon={Plus} data-new-record onClick={() => setCreateOpen(true)}>Create loan</Button>
                  </>
                }
              />
              {table}
            </>
          }
          detail={list.selectedId ? <LoanDetailView loanId={list.selectedId} embedded /> : null}
        />
      ) : (
        <>
          <PageHeader
            title="Loans"
            count={meta?.totalCount}
            actions={
              <>
                {split.available && (
                  <Switch label="Split view" checked={false} onCheckedChange={() => split.setPreference(true)} />
                )}
                <Button icon={Plus} data-new-record onClick={() => setCreateOpen(true)}>Create loan</Button>
              </>
            }
          />
          {table}
        </>
      )}
      <CreateLoanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(loanId) => {
          if (loanId) navigate(`/loans/${loanId}`);
          else if (list.page === 1) void refetch();
          else list.setPage(1);
        }}
      />
    </>
  );
}


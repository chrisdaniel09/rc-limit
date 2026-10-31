import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { apiPost } from '@/api/client';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useListState } from '@/hooks/useListState';
import { useThresholds } from '@/theme/ThemeProvider';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar, SavedViews, type FilterDef } from '@/components/FilterBar';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { CurrencyInput, PhoneInput } from '@/components/inputs';
import { UtilizationMeter } from '@/components/metrics';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import { CUSTOMER_TYPES } from './customerShared';
import { humanize } from '@/lib/format';
import { isValidIndianMobile, INDIAN_MOBILE_MESSAGE, toPhoneNumber } from '@/utils/phone';

interface Customer {
  customerId: string;
  legalName: string;
  tradeName: string | null;
  customerType: string;
  cibilScore: number | null;
  cibilTier: string | null;
  riskStatus: string;
  assignedCeiling: number;
  currentUtilization: number;
  stopSupplyFlag: boolean;
  pendingRcCount?: number | null;
  maxPendingRcAllowed?: number | null;
}


const INITIAL_FILTERS = { customerType: '', riskStatus: '', cibilTier: '', stopSupply: '', utilizationBand: '' };

const schema = z.object({
  legalName: z.string().trim().min(2, 'Enter the legal name').max(200),
  tradeName: z.string().max(200),
  customerType: z.enum(['DEALER', 'INDIVIDUAL']),
  phoneNumber: z.string().refine((v) => v === '' || isValidIndianMobile(v), INDIAN_MOBILE_MESSAGE),
  assignedCeiling: z.number({ error: 'Enter the sub-limit' }).positive('Enter an amount greater than zero'),
});

function AddCustomerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string | null) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useZodForm(schema, { legalName: '', tradeName: '', customerType: 'DEALER', phoneNumber: '', assignedCeiling: null as unknown as number });
  const { control, handleSubmit, reset, formState } = form;
  useEffect(() => {
    if (open) {
      reset();
      setServerError(null);
    }
  }, [open, reset]);

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      const res = await apiPost<{ data?: { customerId?: string }; customerId?: string }>('/api/v1/customers', {
        legalName: v.legalName,
        tradeName: v.tradeName || null,
        customerType: v.customerType,
        phoneNumber: toPhoneNumber(v.phoneNumber),
        assignedCeiling: v.assignedCeiling,
      });
      notifySuccess('Customer added');
      onOpenChange(false);
      onCreated(res?.data?.customerId ?? res?.customerId ?? null);
    } catch (err) {
      setServerError(errorMessage(err, "The customer wasn't added."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add customer"
      dirty={formState.isDirty}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Adding…">Add customer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField control={control} name="legalName" label="Legal name" required render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} autoFocus />} />
        <FormField control={control} name="tradeName" label="Trade name" optional render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
        <FormField
          control={control}
          name="customerType"
          label="Type"
          required
          render={(f) => <Segmented aria-label="Customer type" value={f.value} onValueChange={(v) => f.onChange(v as 'DEALER')} options={CUSTOMER_TYPES} />}
        />
        <FormField control={control} name="phoneNumber" label="Phone" optional render={(f) => <PhoneInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} />} />
        <FormField
          control={control}
          name="assignedCeiling"
          label="Sub-limit ceiling"
          required
          render={(f) => <CurrencyInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} showWords />}
        />
      </div>
    </ResponsiveDialog>
  );
}

// §10.5 Customers list.
export default function CustomersPage() {
  const list = useListState({ storageKey: 'customers.pageSize', defaultSortBy: 'legalName', defaultSortDir: 'asc', initialFilters: INITIAL_FILTERS });
  const thresholds = useThresholds();
  // Utilization bands use the tenant's thresholds, which live in the System module, so the page passes them.
  const { data, meta, loading, error, refetch } = useFetch<Customer[]>(
    `/api/v1/customers?${list.query}&warnPct=${thresholds.warnPct}&dangerPct=${thresholds.dangerPct}`, [], { staleAfter: LIST_STALE_MS },
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAddOpen(true);
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filters: FilterDef[] = [
    { key: 'customerType', label: 'Type', type: 'single', options: CUSTOMER_TYPES },
    { key: 'riskStatus', label: 'Risk', type: 'multi', options: ['ACTIVE', 'FLAGGED', 'SUSPENDED', 'DEFAULTED'].map((v) => ({ value: v, label: humanize(v) })) },
    { key: 'cibilTier', label: 'CIBIL tier', type: 'multi', options: [{ value: 'GREEN', label: 'Green' }, { value: 'AMBER', label: 'Amber' }, { value: 'RED', label: 'Red' }] },
    { key: 'stopSupply', label: 'Stop supply', type: 'boolean', trueLabel: 'On stop supply' },
    { key: 'utilizationBand', label: 'Utilization', type: 'single', options: [{ value: 'LOW', label: 'Below warning' }, { value: 'WARN', label: 'Approaching ceiling' }, { value: 'HIGH', label: 'At or over ceiling' }] },
  ];

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'legalName', header: 'Legal name', sortKey: 'legalName', mobile: 'title',
      cell: (c) => (
        <span className="block max-w-64">
          <span className="block truncate">{c.legalName}</span>
          {c.tradeName && <span className="block truncate text-caption font-normal text-muted-foreground">{c.tradeName}</span>}
        </span>
      ),
    },
    { id: 'type', header: 'Type', sortKey: 'customerType', mobile: 'subtitle', priority: 2, cell: (c) => humanize(c.customerType) },
    {
      id: 'cibil', header: 'CIBIL', kind: 'number', mobile: 'meta',
      cell: (c) => (c.cibilScore == null && !c.cibilTier ? <Empty /> : (
        <span className="inline-flex items-center gap-2">
          {c.cibilScore != null && <span className="num">{c.cibilScore}</span>}
          {c.cibilTier && <StatusBadge status={c.cibilTier} inTable />}
        </span>
      )),
    },
    { id: 'risk', header: 'Risk', sortKey: 'riskStatus', kind: 'status', mobile: 'badge', cell: (c) => <StatusBadge status={c.riskStatus} inTable /> },
    { id: 'subLimit', header: 'Sub-limit', mobile: 'meta', className: 'w-48', cell: (c) => <UtilizationMeter compact used={c.currentUtilization} ceiling={c.assignedCeiling} /> },
    {
      id: 'pendingRc', header: 'Pending RCs', kind: 'number', priority: 3, hideable: true, mobile: 'hidden',
      cell: (c) => (c.pendingRcCount == null ? <Empty /> : (
        <span className={c.maxPendingRcAllowed != null && c.pendingRcCount >= c.maxPendingRcAllowed ? 'text-warning' : undefined}>
          {c.pendingRcCount}{c.maxPendingRcAllowed != null && ` / ${c.maxPendingRcAllowed}`}
        </span>
      )),
    },
    // Only shown when true: the old green "OK" on every row was noise (§10.5).
    { id: 'stopSupply', header: 'Stop supply', kind: 'status', mobile: 'badge', cell: (c) => (c.stopSupplyFlag ? <StatusBadge status="STOP_SUPPLY" inTable /> : null) },
  ];

  return (
    <>
      <PageHeader title="Customers" count={meta?.totalCount} actions={<Button icon={Plus} data-new-record onClick={() => setAddOpen(true)}>Add customer</Button>} />
      <FilterBar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search name or phone…"
        filters={filters}
        values={list.filters}
        onChange={(c) => list.setFilters(c as Partial<typeof INITIAL_FILTERS>)}
        onClearAll={list.clearFilters}
        resultCount={meta?.totalCount}
        resultLabel="customers"
        savedViews={
          <SavedViews
            storageKey="customers"
            defaults={[{ id: 'stop-supply', name: 'On stop supply', filters: { stopSupply: 'true' } }, { id: 'near-ceiling', name: 'Near ceiling', filters: { utilizationBand: 'HIGH' } }]}
            current={{ q: list.search, sort: list.sortBy, dir: list.sortDir, filters: list.filters }}
            onApply={(v) => list.applyView({ q: v.q, sort: v.sort, dir: v.dir, filters: v.filters as Partial<typeof INITIAL_FILTERS> })}
          />
        }
      />
      <DataTable
        label="Customers"
        columns={columns}
        rows={data}
        getRowId={(c) => c.customerId}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowHref={(c) => `/customers/${c.customerId}`}
        rowAttention={(c) => c.stopSupplyFlag}
        sort={{ sortBy: list.sortBy, sortDir: list.sortDir, onSort: list.updateSort, onSortChange: list.setSort }}
        isFiltered={list.isFiltered}
        onClearFilters={list.clearFilters}
        columnsKey="customers"
        accumulate={{ page: list.page, viewKey: list.viewKey }}
        empty={{ title: 'No customers yet', description: 'Add a dealer or individual to give them a sub-limit.', action: <Button icon={Plus} onClick={() => setAddOpen(true)}>Add customer</Button> }}
        footer={<Pagination meta={meta} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} loading={loading} />}
      />
      <AddCustomerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => {
          if (id) navigate(`/customers/${id}`);
          else void refetch();
        }}
      />
    </>
  );
}


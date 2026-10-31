import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { apiPost } from '@/api/client';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useListState } from '@/hooks/useListState';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar, type FilterDef } from '@/components/FilterBar';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { PercentInput, PhoneInput } from '@/components/inputs';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import { formatPercent, formatPhone } from '@/lib/format';
import { INDIAN_MOBILE_MESSAGE, isValidIndianMobile, toPhoneNumber } from '@/utils/phone';

interface Partner {
  partnerId: string;
  legalName: string;
  partnerType: string;
  phoneNumber: string | null;
  defaultCommissionSplitPct: number;
  status: string;
}

const PARTNER_TYPES = [
  { value: 'SUB_BROKER', label: 'Sub-broker' },
  { value: 'DSA_AGENT', label: 'DSA agent' },
];

const schema = z.object({
  legalName: z.string().trim().min(2, 'Enter the legal name').max(200),
  partnerType: z.enum(['SUB_BROKER', 'DSA_AGENT']),
  phoneNumber: z.string().refine((v) => v === '' || isValidIndianMobile(v), INDIAN_MOBILE_MESSAGE),
  defaultCommissionSplitPct: z.number({ error: 'Enter the commission split' }).min(0).max(100, 'At most 100%'),
});

const INITIAL_FILTERS = { status: '', partnerType: '' };

// §10.10 Partners.
export default function PartnersPage() {
  const list = useListState({ storageKey: 'partners.pageSize', defaultSortBy: 'legalName', defaultSortDir: 'asc', initialFilters: INITIAL_FILTERS });
  const { data, meta, loading, error, refetch } = useFetch<Partner[]>(`/api/v1/partners?${list.query}`, [], { staleAfter: LIST_STALE_MS });
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useZodForm(schema, { legalName: '', partnerType: 'SUB_BROKER', phoneNumber: '', defaultCommissionSplitPct: 70 });
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
      await apiPost('/api/v1/partners', { ...v, phoneNumber: toPhoneNumber(v.phoneNumber) });
      notifySuccess('Partner added');
      setOpen(false);
      if (list.page === 1) void refetch();
      else list.setPage(1);
    } catch (err) {
      setServerError(errorMessage(err, "The partner wasn't added."));
    }
  }, focusFirstError);

  const filters: FilterDef[] = [
    { key: 'partnerType', label: 'Type', type: 'single', options: PARTNER_TYPES },
    { key: 'status', label: 'Status', type: 'single', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }] },
  ];

  const columns: ColumnDef<Partner>[] = [
    { id: 'name', header: 'Legal name', sortKey: 'legalName', mobile: 'title', cell: (p) => p.legalName },
    { id: 'type', header: 'Type', sortKey: 'partnerType', mobile: 'subtitle', cell: (p) => PARTNER_TYPES.find((t) => t.value === p.partnerType)?.label ?? p.partnerType },
    { id: 'phone', header: 'Phone', kind: 'number', align: 'start', mobile: 'meta', cell: (p) => (p.phoneNumber ? <a href={`tel:${p.phoneNumber}`} className="relative z-10 hover:underline">{formatPhone(p.phoneNumber)}</a> : <Empty />) },
    { id: 'commission', header: 'Commission', kind: 'number', mobile: 'meta', cell: (p) => formatPercent(p.defaultCommissionSplitPct) },
    { id: 'status', header: 'Status', sortKey: 'status', kind: 'status', mobile: 'badge', cell: (p) => <StatusBadge status={p.status} inTable /> },
  ];

  return (
    <>
      <PageHeader title="Partners" count={meta?.totalCount} actions={<Button icon={Plus} data-new-record onClick={() => setOpen(true)}>Add partner</Button>} />
      <FilterBar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search name or phone…"
        filters={filters}
        values={list.filters}
        onChange={(c) => list.setFilters(c as Partial<typeof INITIAL_FILTERS>)}
        onClearAll={list.clearFilters}
        resultCount={meta?.totalCount}
        resultLabel="partners"
      />
      <DataTable
        label="Partners"
        columns={columns}
        rows={data}
        getRowId={(p) => p.partnerId}
        loading={loading}
        error={error}
        onRetry={refetch}
        sort={{ sortBy: list.sortBy, sortDir: list.sortDir, onSort: list.updateSort, onSortChange: list.setSort }}
        isFiltered={list.isFiltered}
        onClearFilters={list.clearFilters}
        accumulate={{ page: list.page, viewKey: list.viewKey }}
        empty={{ title: 'No partners yet', description: 'Add sub-brokers and DSA agents who source loans.', action: <Button icon={Plus} onClick={() => setOpen(true)}>Add partner</Button> }}
        footer={<Pagination meta={meta} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} loading={loading} />}
      />
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Add partner"
        dirty={formState.isDirty}
        error={serverError}
        onSubmit={() => void submit()}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={formState.isSubmitting} loadingText="Adding…">Add partner</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField control={control} name="legalName" label="Legal name" required render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} autoFocus />} />
          <FormField control={control} name="partnerType" label="Type" required render={(f) => <Segmented aria-label="Partner type" value={f.value} onValueChange={(v) => f.onChange(v as 'SUB_BROKER')} options={PARTNER_TYPES} />} />
          <FormField control={control} name="phoneNumber" label="Phone" optional render={(f) => <PhoneInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} />} />
          <FormField control={control} name="defaultCommissionSplitPct" label="Commission split" required hint="The partner's share of the payout." render={(f) => <PercentInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} />} />
        </div>
      </ResponsiveDialog>
    </>
  );
}

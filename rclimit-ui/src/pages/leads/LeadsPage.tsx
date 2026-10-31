import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Columns2, MessageCircle, Phone, Plus, UserPlus } from 'lucide-react';
import { apiPut } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useListState } from '@/hooks/useListState';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { BulkBar, FilterBar, SavedViews, type FilterDef } from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Segmented, Switch } from '@/components/ui/choice';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Empty } from '@/components/ui/feedback';
import { notifyError, notifySuccess } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Avatar } from '@/layouts/Topbar';
import { PageHeader } from '@/layouts/templates';
import { SplitView, useSplitPreference } from '@/layouts/SplitView';
import { formatDateTime, formatPhone, formatRelative } from '@/lib/format';
import AddLeadDialog from './AddLeadDialog';
import { LeadDetailView } from './LeadDetailPage';
import type { ProductType } from './productTypes';
import { LEAD_SOURCES, LEAD_STATUS_OPTIONS, UNASSIGNED, sourceLabel, type LeadListItem, type StaffUser } from './leadShared';

const INITIAL_FILTERS = { assignedToMe: '', leadStatus: '', productTypeCode: '', leadSource: '', assignedTo: '', createdFrom: '', createdTo: '' };

// §10.3 Leads list; split view on by default at ≥ 1280 px (§15-8).
export default function LeadsPage() {
  const navigate = useNavigate();
  const { hasRight } = useAuth();
  const canEdit = hasRight('leads.edit');
  const list = useListState({ storageKey: 'leads.pageSize', defaultSortBy: 'createdAt', defaultSortDir: 'desc', initialFilters: INITIAL_FILTERS });
  const { data, meta, loading, error, refetch } = useFetch<LeadListItem[]>(`/api/v1/leads?${list.query}`, [], { staleAfter: LIST_STALE_MS });
  const { data: users } = useFetch<StaffUser[]>('/api/v1/users/lookup');
  const { data: productTypes } = useFetch<ProductType[]>('/api/v1/lead-product-types');
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const split = useSplitPreference('leads', true);
  const scope = list.filters.assignedToMe === 'true' ? 'mine' : 'all';

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAddOpen(true);
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('new'); return n; }, { replace: true });
    }
    // Dashboard link: /leads?scope=mine.
    if (searchParams.get('scope') === 'mine') {
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('scope'); n.set('assignedToMe', 'true'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Clear the selection when the view changes, so bulk actions never apply to rows that aren't shown.
  useEffect(() => setSelected(new Set()), [list.viewKey, list.page]);

  const requirementLabel = (code: string) => productTypes?.find((p) => p.code === code)?.label ?? code;
  const userOptions = (users ?? []).map((u) => ({ value: u.userId, label: u.fullName || u.email || u.userId, secondary: u.email ?? undefined }));

  const filters: FilterDef[] = useMemo(() => [
    { key: 'leadStatus', label: 'Status', type: 'multi', options: LEAD_STATUS_OPTIONS },
    { key: 'productTypeCode', label: 'Requirement', type: 'single', options: (productTypes ?? []).map((p) => ({ value: p.code, label: p.label })) },
    { key: 'leadSource', label: 'Source', type: 'multi', options: LEAD_SOURCES },
    { key: 'assignedTo', label: 'Assigned to', type: 'combobox', options: [{ value: UNASSIGNED, label: 'Unassigned' }, ...userOptions] },
    { key: 'created', label: 'Created', type: 'dateRange', from: 'createdFrom', to: 'createdTo' },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [productTypes, users]);

  const columns: ColumnDef<LeadListItem>[] = [
    {
      id: 'applicant', header: 'Applicant', sortKey: 'applicantName', mobile: 'title',
      cell: (l) => (
        <span className="block max-w-56">
          <span className="block truncate">{l.applicantName}</span>
          <span className="num block truncate text-caption font-normal text-muted-foreground">{formatPhone(l.whatsappPhoneNumber)}</span>
        </span>
      ),
    },
    { id: 'requirement', header: 'Requirement', mobile: 'subtitle', cell: (l) => requirementLabel(l.productTypeCode) },
    { id: 'reference', header: 'Reference', kind: 'id', priority: 3, hideable: true, mobile: 'hidden', cell: (l) => l.referenceNumber ?? <Empty /> },
    { id: 'source', header: 'Source', sortKey: 'leadSource', priority: 2, hideable: true, mobile: 'subtitle', cell: (l) => sourceLabel(l.leadSource) },
    // Not sortable: the name is resolved from the Identity module after paging, so the database cannot order by it.
    {
      id: 'assigned', header: 'Assigned to', priority: 2, hideable: true, mobile: 'meta',
      cell: (l) => (l.assignedToUserName ? (
        <span className="inline-flex items-center gap-2"><Avatar name={l.assignedToUserName} size="sm" />{l.assignedToUserName}</span>
      ) : <Empty>Unassigned</Empty>),
    },
    {
      id: 'checks', header: 'Checks', priority: 3, hideable: true, mobile: 'meta',
      cell: (l) => (l.cibilCheckStatus === undefined && l.rcCheckStatus === undefined ? <Empty /> : (
        <span className="inline-flex gap-1">
          <Tooltip content="CIBIL check"><span><StatusBadge status={l.cibilCheckStatus} domain="check" inTable /></span></Tooltip>
          <Tooltip content="RC check"><span><StatusBadge status={l.rcCheckStatus} domain="check" inTable /></span></Tooltip>
        </span>
      )),
    },
    { id: 'status', header: 'Status', sortKey: 'leadStatus', kind: 'status', mobile: 'badge', cell: (l) => <StatusBadge status={l.leadStatus} domain="lead" inTable /> },
    {
      id: 'created', header: 'Created', sortKey: 'createdAt', kind: 'date', priority: 2, mobile: 'meta',
      cell: (l) => <time dateTime={l.createdAt} title={formatDateTime(l.createdAt)}>{formatRelative(l.createdAt)}</time>,
    },
  ];

  const visibleColumns = split.enabled ? columns.filter((c) => ['applicant', 'requirement', 'status'].includes(c.id)) : columns;

  const bulkAssign = async () => {
    setAssigning(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => apiPut(`/api/v1/leads/${id}/assign`, { assigneeUserId: assignee || null })));
    const failed = results.filter((r) => r.status === 'rejected');
    setAssigning(false);
    setAssignOpen(false);
    setSelected(new Set());
    void refetch();
    if (failed.length === 0) notifySuccess(`${ids.length} ${ids.length === 1 ? 'lead' : 'leads'} assigned`);
    else notifyError((failed[0] as PromiseRejectedResult).reason, `${failed.length} of ${ids.length} leads weren't assigned`);
  };

  const scopeControl = (
    <Segmented
      aria-label="Which leads"
      value={scope}
      onValueChange={(v) => list.updateFilter('assignedToMe', v === 'mine' ? 'true' : '')}
      options={[{ value: 'all', label: 'All' }, { value: 'mine', label: 'Assigned to me' }]}
    />
  );

  const table = (
    <>
      <FilterBar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder="Search applicant, phone or registration…"
        filters={filters}
        values={list.filters}
        onChange={(c) => list.setFilters(c as Partial<typeof INITIAL_FILTERS>)}
        onClearAll={list.clearFilters}
        resultCount={meta?.totalCount}
        resultLabel="leads"
        savedViews={!split.enabled && (
          <SavedViews
            storageKey="leads"
            defaults={[
              { id: 'my-open', name: 'My open leads', filters: { assignedToMe: 'true', leadStatus: 'NEW,IN_PROGRESS,QUALIFIED' } },
              { id: 'unassigned', name: 'Unassigned', filters: { assignedTo: UNASSIGNED } },
            ]}
            current={{ q: list.search, sort: list.sortBy, dir: list.sortDir, filters: list.filters }}
            onApply={(v) => list.applyView({ q: v.q, sort: v.sort, dir: v.dir, filters: v.filters as Partial<typeof INITIAL_FILTERS> })}
          />
        )}
      />
      <DataTable
        label="Leads"
        columns={visibleColumns}
        rows={data}
        getRowId={(l) => l.leadId}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowHref={(l) => `/leads/${l.leadId}`}
        onRowClick={split.enabled ? (l) => list.setSelectedId(l.leadId) : undefined}
        onMove={split.enabled ? (l) => list.setSelectedId(l.leadId) : undefined}
        selectedId={split.enabled ? list.selectedId : undefined}
        sort={{ sortBy: list.sortBy, sortDir: list.sortDir, onSort: list.updateSort, onSortChange: list.setSort }}
        isFiltered={list.isFiltered}
        onClearFilters={list.clearFilters}
        columnsKey={split.enabled ? undefined : 'leads'}
        accumulate={{ page: list.page, viewKey: list.viewKey }}
        selection={canEdit && !split.enabled ? { selected, onChange: setSelected } : undefined}
        bulkBar={
          <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button size="sm" variant="outline" icon={UserPlus} onClick={() => { setAssignee(''); setAssignOpen(true); }}>Assign to…</Button>
          </BulkBar>
        }
        mobileActions={(l) => (
          <>
            <Button variant="outline" size="sm" icon={Phone} asChild><a href={`tel:${l.contactPhone ?? l.whatsappPhoneNumber}`}>Call</a></Button>
            <Button variant="outline" size="sm" icon={MessageCircle} asChild>
              <a href={`https://wa.me/${l.whatsappPhoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
            </Button>
          </>
        )}
        empty={{
          title: scope === 'mine' ? 'No leads assigned to you' : 'No leads yet',
          description: 'Leads from WhatsApp, walk-ins and referrals land here.',
          action: <Button icon={Plus} onClick={() => setAddOpen(true)}>Add lead</Button>,
        }}
        footer={<Pagination meta={meta} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} loading={loading} />}
      />
    </>
  );

  const header = (compact: boolean) => (
    <PageHeader
      title="Leads"
      count={meta?.totalCount}
      actions={
        <>
          {split.available && (
            <Switch
              label={compact ? <Columns2 aria-label="Split view" className="size-4" /> : 'Split view'}
              checked={split.enabled}
              onCheckedChange={split.setPreference}
            />
          )}
          <Button icon={Plus} data-new-record onClick={() => setAddOpen(true)}>Add lead</Button>
        </>
      }
    >
      {scopeControl}
    </PageHeader>
  );

  return (
    <>
      {split.enabled ? (
        <SplitView
          storageKey="leads"
          onClose={() => list.setSelectedId(null)}
          fullPageHref={list.selectedId ? `/leads/${list.selectedId}` : null}
          list={<>{header(true)}{table}</>}
          detail={list.selectedId ? <LeadDetailView leadId={list.selectedId} embedded onChanged={() => void refetch()} /> : null}
        />
      ) : (
        <>{header(false)}{table}</>
      )}

      <AddLeadDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        productTypes={productTypes ?? []}
        users={users ?? []}
        onCreated={(id) => {
          if (id && split.enabled) {
            list.setSelectedId(id);
            void refetch();
          } else if (id) navigate(`/leads/${id}`);
          else void refetch();
        }}
      />

      <ResponsiveDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title={`Assign ${selected.size} ${selected.size === 1 ? 'lead' : 'leads'}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button loading={assigning} loadingText="Assigning…" onClick={() => void bulkAssign()}>Assign</Button>
          </>
        }
      >
        <Field label="Team member" hint="Leave empty to unassign.">
          <Combobox value={assignee} onValueChange={(v) => setAssignee(v)} options={userOptions} placeholder="Unassigned" clearable />
        </Field>
      </ResponsiveDialog>
    </>
  );
}


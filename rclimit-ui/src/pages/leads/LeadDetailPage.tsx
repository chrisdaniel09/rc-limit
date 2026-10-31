import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, ClipboardCheck, Copy, Lock, MessageCircle, Phone, RotateCw, UserCheck, XCircle } from 'lucide-react';
import { apiPut } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { DETAIL_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useIsWide } from '@/hooks/useMediaQuery';
import { ActionButton, BlockedReasons, resolveAction } from '@/components/ActionButton';
import ActivityThread, { type ActivityEvent } from '@/components/ActivityThread';
import StatusBadge from '@/components/StatusBadge';
import Badge from '@/components/Badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Combobox } from '@/components/ui/combobox';
import { Card, DescriptionList, Empty, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { DropdownMenu, MenuContent } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { notifyError, toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useRecordTitle } from '@/layouts/PageMeta';
import { MetaSep, RecordHeader, StickyActionDock } from '@/layouts/templates';
import { formatDate, formatDateTime, formatPhone, formatRelative, formatRegNo } from '@/lib/format';
import ConvertLeadDialog from './ConvertLeadDialog';
import RecordResultSheet, { type ResultMode } from './RecordResultSheet';
import { ACTION_LABELS, type ActionRun, type ProductType } from './productTypes';
import { SETTABLE_LEAD_STATUSES, sourceLabel, type LeadDetail, type StaffUser } from './leadShared';

// §8.20 StatusTile: neutral surface; only the badge carries tone. Split button "Record result ▾".
function StatusTile({ label, run, onChoose }: { label: string; run: ActionRun | undefined; onChoose: (mode: ResultMode) => void }) {
  const outcome = run?.status === 'FAILED' ? null : run?.response?.outcome ?? null;
  return (
    <div className="flex min-w-60 snap-center flex-col justify-between gap-3 rounded-lg border bg-surface p-4 shadow-xs dark:shadow-none">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-label text-muted-foreground">{label}</p>
          <div className="mt-1.5"><StatusBadge status={outcome} domain="check" /></div>
        </div>
      </div>
      <p className="text-caption text-muted-foreground">
        {run ? <time dateTime={run.startedAt} title={formatDateTime(run.startedAt)}>Last run {formatRelative(run.startedAt)}</time> : 'Not run yet'}
      </p>
      <div className="flex">
        <Button variant="outline" size="sm" className="flex-1 rounded-r-none" onClick={() => onChoose('manual')}>Record result</Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline" size="sm" aria-label={`More options for ${label}`} className="rounded-l-none border-l-0 px-2"><ChevronDown /></Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <MenuContent>
              {(['manual', 'automated', 'history'] as const).map((m) => (
                <DropdownMenu.Item key={m} onSelect={() => onChoose(m)} className="cursor-default rounded-sm px-2 py-1.5 text-sm capitalize outline-none data-[highlighted]:bg-muted pointer-coarse:py-3">
                  {m === 'history' ? 'History' : m === 'manual' ? 'Manual' : 'Automated'}
                </DropdownMenu.Item>
              ))}
            </MenuContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

export function LeadDetailView({ leadId, embedded = false, onChanged }: { leadId: string; embedded?: boolean; onChanged?: () => void }) {
  const { hasRight } = useAuth();
  const confirm = useConfirm();
  const isWide = useIsWide();
  const { data: lead, links, actions, error, loading, refetch } = useFetch<LeadDetail>(`/api/v1/leads/${leadId}`, [leadId], { staleAfter: DETAIL_STALE_MS });
  const { data: users } = useFetch<StaffUser[]>('/api/v1/users/lookup');
  const { data: productTypes } = useFetch<ProductType[]>('/api/v1/lead-product-types');
  const [sheet, setSheet] = useState<{ actionCode: string; mode: ResultMode } | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [saving, setSaving] = useState<null | 'assign' | 'status'>(null);

  useRecordTitle(embedded ? null : lead?.applicantName);

  if (error && !lead) {
    return <Alert tone="danger" title="This lead didn't load" action={<Button variant="outline" size="sm" icon={RotateCw} onClick={refetch}>Retry</Button>}>{error}</Alert>;
  }
  if (!lead) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const canEditRight = hasRight('leads.edit');
  const canEdit = canEditRight && !lead.isLocked;
  const requirementLabel = productTypes?.find((p) => p.code === lead.productTypeCode)?.label ?? lead.productTypeCode;
  const latestRun = (code: string) => lead.actionHistory.find((r) => r.actionCode === code);
  const after = () => {
    void refetch();
    onChanged?.();
  };

  // Primary workflow action: shown disabled with a reason rather than hidden (§9.2).
  const convertState = lead.convertedCustomerId
    ? ({ visible: false } as const)
    : resolveAction({ links, actions }, 'convert', {
        legacyAvailable: true,
        hasRight: canEditRight,
        primary: true,
        permissionReason: "You don't have permission to convert leads.",
      });

  // Save on change, with undo for 5 s (§11.2).
  const saveAssignment = async (userId: string, undo = true) => {
    const previous = lead.assignedToUserId ?? '';
    setSaving('assign');
    try {
      await apiPut(`/api/v1/leads/${lead.leadId}/assign`, { assigneeUserId: userId || null });
      after();
      const name = users?.find((u) => u.userId === userId)?.fullName;
      if (undo) toast.success(userId ? `Assigned to ${name ?? 'team member'}` : 'Lead unassigned', { duration: 5000, action: { label: 'Undo', onClick: () => void saveAssignment(previous, false) } });
    } catch (err) {
      notifyError(err, "The assignment wasn't saved");
    } finally {
      setSaving(null);
    }
  };

  const saveStatus = async (status: string, undo = true) => {
    const previous = lead.leadStatus;
    if (status === 'REJECTED' && undo) {
      const ok = await confirm({ title: 'Reject this lead?', description: 'A rejected lead drops out of open work. You can change the status back later.', confirmLabel: 'Reject lead', tone: 'danger' });
      if (!ok) return;
    }
    setSaving('status');
    try {
      await apiPut(`/api/v1/leads/${lead.leadId}/status`, { status });
      after();
      if (undo) {
        const label = SETTABLE_LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
        toast.success(`Status set to ${label.toLowerCase()}`, { duration: 5000, action: { label: 'Undo', onClick: () => void saveStatus(previous, false) } });
      }
    } catch (err) {
      notifyError(err, "The status wasn't saved");
    } finally {
      setSaving(null);
    }
  };

  const copyId = () => {
    void navigator.clipboard?.writeText(lead.leadId);
    toast.success('Lead ID copied');
  };

  const events: ActivityEvent[] = lead.actionHistory.map((run) => ({
    id: run.executionId,
    at: run.startedAt,
    icon: ClipboardCheck,
    text: run.status === 'FAILED'
      ? `${ACTION_LABELS[run.actionCode] ?? run.actionCode} not recorded`
      : `${ACTION_LABELS[run.actionCode] ?? run.actionCode}: ${run.response?.outcome?.toLowerCase().replace('_', ' ') ?? 'recorded'}`,
  }));
  if (lead.convertedAt) events.push({ id: 'converted', at: lead.convertedAt, icon: UserCheck, text: `Converted to ${lead.convertedCustomerName ?? 'customer'}` });

  const userOptions = (users ?? []).map((u) => ({ value: u.userId, label: u.fullName || u.email || u.userId, secondary: u.email ?? undefined }));
  const phone = lead.contactPhone ?? lead.whatsappPhoneNumber;

  const overview = (
    <div className="space-y-4">
      <Card title="Assignment and status" description={canEdit ? 'Changes save straight away.' : undefined}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Assigned to">
            <Combobox
              value={lead.assignedToUserId ?? ''}
              onValueChange={(v) => void saveAssignment(v)}
              options={userOptions}
              selectedLabel={lead.assignedToUserName ?? undefined}
              placeholder="Unassigned"
              disabled={!canEdit || saving === 'assign'}
              clearable={canEdit}
            />
          </Field>
          <Field label="Lead status">
            <Select
              value={lead.leadStatus === 'CONVERTED' ? '' : lead.leadStatus}
              onValueChange={(v) => void saveStatus(v)}
              options={SETTABLE_LEAD_STATUSES}
              placeholder="Converted"
              disabled={!canEdit || saving === 'status'}
            />
          </Field>
        </div>
      </Card>
      <Card title="Lead information">
        <DescriptionList
          columns={4}
          items={[
            { label: 'Financial requirement', value: requirementLabel },
            { label: 'Source', value: sourceLabel(lead.leadSource) },
            { label: 'Brought in by', value: lead.referredByUserName ?? <Empty /> },
            { label: 'WhatsApp', value: <span className="num">{formatPhone(lead.whatsappPhoneNumber)}</span> },
            { label: 'Contact phone', value: lead.contactPhone ? <span className="num">{formatPhone(lead.contactPhone)}</span> : <Empty /> },
            { label: 'Reference', value: lead.referenceNumber ? <span className="id-mono">{lead.referenceNumber}</span> : <Empty /> },
            ...lead.fieldSchema.map((field) => {
              const value = lead.productDetails[field.key];
              const empty = value === null || value === undefined || value === '';
              return {
                label: field.label,
                value: empty ? <Empty /> : field.role === 'vehicle_registration'
                  ? <span className="id-mono">{formatRegNo(String(value))}</span>
                  : field.type === 'date' ? <span className="num">{formatDate(String(value))}</span> : String(value),
              };
            }),
            { label: 'Notes', value: lead.notes ? <span className="whitespace-pre-wrap font-normal">{lead.notes}</span> : <Empty />, className: 'sm:col-span-2 lg:col-span-3 xl:col-span-4' },
          ]}
        />
      </Card>
    </div>
  );

  const checksHistory = lead.actionHistory.length === 0 ? (
    <EmptyState title="No checks recorded" description="Results for CIBIL, RC and other checks show up here." />
  ) : (
    <Card flush>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-label text-muted-foreground">
            <tr>
              <th className="h-10 px-cell font-medium">When</th>
              <th className="px-cell font-medium">Check</th>
              <th className="px-cell font-medium">Result</th>
              <th className="px-cell text-right font-medium">Score</th>
              <th className="px-cell font-medium">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lead.actionHistory.map((run) => (
              <tr key={run.executionId} className="h-row">
                <td className="num whitespace-nowrap px-cell">{formatDateTime(run.startedAt)}</td>
                <td className="px-cell">{ACTION_LABELS[run.actionCode] ?? run.actionCode}</td>
                <td className="px-cell">{run.status === 'FAILED' ? <StatusBadge status="FAILED" domain="check" inTable /> : <StatusBadge status={run.response?.outcome} domain="check" inTable />}</td>
                <td className="num px-cell text-right">{run.response?.score ?? <Empty />}</td>
                <td className="max-w-72 truncate px-cell text-muted-foreground">{run.status === 'FAILED' ? run.error : run.response?.remarks ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const activity = (
    <ActivityThread commentsPath={`/api/v1/leads/${lead.leadId}/comments`} canComment={canEditRight} events={events} />
  );

  const convertButton = lead.convertedCustomerId ? (
    <Button variant="outline" icon={UserCheck} asChild>
      <Link to={`/customers/${lead.convertedCustomerId}`}>View customer</Link>
    </Button>
  ) : (
    <ActionButton state={convertState} icon={UserCheck} onClick={() => setConvertOpen(true)}>Convert to customer</ActionButton>
  );

  // Right rail for activity on wide full-page views; a tab otherwise (§10.4).
  const showRail = !embedded && isWide;

  return (
    <>
      {lead.isLocked && lead.convertedCustomerId && (
        <Alert
          tone="info"
          icon={Lock}
          className="mb-4"
          action={<Button variant="link" asChild><Link to={`/customers/${lead.convertedCustomerId}`}>View customer</Link></Button>}
        >
          This lead was converted to <span className="font-medium">{lead.convertedCustomerName}</span> on {formatDate(lead.convertedAt)}. It's read-only now.
        </Alert>
      )}

      <RecordHeader
        title={lead.applicantName || 'Unknown applicant'}
        badges={<><Badge text={sourceLabel(lead.leadSource)} /><StatusBadge status={lead.leadStatus} domain="lead" /></>}
        meta={
          <>
            <a href={`tel:${phone}`} className="num inline-flex items-center gap-1 text-foreground hover:underline"><Phone aria-hidden className="size-3.5" />{formatPhone(phone)}</a>
            {lead.referenceNumber && <><MetaSep /><span className="id-mono">{lead.referenceNumber}</span></>}
            <MetaSep />
            <span>Created {formatDate(lead.createdAt)}</span>
            <MetaSep />
            <Tooltip content="Copy lead ID">
              <button type="button" onClick={copyId} className="id-mono inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                {lead.leadId.slice(0, 8)}<Copy aria-hidden className="size-3" />
              </button>
            </Tooltip>
          </>
        }
        actions={
          <>
            <Tooltip content="Refresh">
              <Button variant="ghost" size="icon" aria-label="Refresh lead" loading={loading} onClick={() => void refetch()}><RotateCw /></Button>
            </Tooltip>
            {canEdit && lead.leadStatus !== 'REJECTED' && (
              <Button variant="outline-danger" icon={XCircle} onClick={() => void saveStatus('REJECTED')}>Reject</Button>
            )}
            {convertButton}
          </>
        }
      />
      <BlockedReasons states={[{ label: 'Convert to customer', state: convertState }]} />

      <div className="-mx-4 mb-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-4">
        {lead.configuredActions.map((action) => (
          <StatusTile
            key={action.code}
            label={ACTION_LABELS[action.code] ?? action.code}
            run={latestRun(action.code)}
            onChoose={(mode) => setSheet({ actionCode: action.code, mode })}
          />
        ))}
        <div className="flex min-w-60 snap-center flex-col justify-between gap-3 rounded-lg border bg-surface p-4 shadow-xs dark:shadow-none">
          <p className="text-label text-muted-foreground">Lead status</p>
          <StatusBadge status={lead.leadStatus} domain="lead" />
          <p className="text-caption text-muted-foreground">{lead.assignedToUserName ? `Assigned to ${lead.assignedToUserName}` : 'Unassigned'}</p>
        </div>
      </div>

      <div className={showRail ? 'grid grid-cols-[minmax(0,1fr)_360px] gap-6' : undefined}>
        <Tabs
          param={embedded ? null : 'tab'}
          tabs={[
            { value: 'overview', label: 'Overview', content: overview },
            { value: 'checks', label: 'Checks', count: lead.actionHistory.length, content: checksHistory },
            { value: 'activity', label: 'Activity', hidden: showRail, content: <Card>{activity}</Card> },
          ]}
        />
        {showRail && (
          <aside aria-label="Activity" className="sticky top-20 flex max-h-[calc(100dvh-7rem)] flex-col rounded-lg border bg-surface p-card">
            <h2 className="mb-3 text-heading">Activity</h2>
            {activity}
          </aside>
        )}
      </div>

      {!embedded && (
        <StickyActionDock>
          {convertButton}
          <Button variant="outline" icon={MessageCircle} asChild>
            <a href={`https://wa.me/${lead.whatsappPhoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
          </Button>
        </StickyActionDock>
      )}

      {sheet && (
        <RecordResultSheet
          open
          onOpenChange={(o) => !o && setSheet(null)}
          lead={lead}
          actionCode={sheet.actionCode}
          mode={sheet.mode}
          onModeChange={(mode) => setSheet((s) => (s ? { ...s, mode } : s))}
          canEdit={canEdit}
          onRecorded={after}
        />
      )}
      <ConvertLeadDialog open={convertOpen} onOpenChange={setConvertOpen} lead={lead} onConverted={after} />
    </>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <LeadDetailView leadId={id!} />;
}

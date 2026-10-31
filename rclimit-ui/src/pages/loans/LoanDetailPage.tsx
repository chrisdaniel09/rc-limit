import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightLeft, Banknote, BadgeCheck, Check, CircleSlash, FilePlus2, LogIn, MoreHorizontal, Plus, RotateCw, SearchCheck, XCircle } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '@/api/client';
import { DETAIL_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/hooks/useAuth';
import { useTerms } from '@/theme/ThemeProvider';
import { ActionButton, BlockedReasons, resolveAction, type ActionState } from '@/components/ActionButton';
import ActivityThread, { type ActivityEvent } from '@/components/ActivityThread';
import LedgerTable, { type LedgerRow } from '@/components/LedgerTable';
import { MetricCard, MetricStrip } from '@/components/metrics';
import StatusBadge from '@/components/StatusBadge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm';
import { Card, DescriptionList, Empty, Skeleton } from '@/components/ui/feedback';
import { ActionMenu, type MenuAction } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { notifyError, toast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useRecordTitle } from '@/layouts/PageMeta';
import { MetaSep, RecordHeader, StickyActionDock } from '@/layouts/templates';
import { cn } from '@/lib/cn';
import { EMPTY, formatDate, formatDays, formatINR, formatPercent, formatRegNo, humanize } from '@/lib/format';
import { getStatus, TONE_TEXT, type Tone } from '@/lib/status';
import { DisburseDialog, LedgerEntryDialog, ReasonDialog, SanctionDialog } from './loanDialogs';
import { STAGE_ACTION_LABELS, STAGE_CONSEQUENCE, WORKFLOW_STEPS, type LoanDetail, type MasterOption } from './loanTypes';

interface DocumentStatus { documentStatusId: string; label: string; isActive: boolean }
interface CustomerSummary { assignedCeiling: number; currentUtilization: number }

const PRODUCT_LABEL: Record<string, string> = { USED_CV: 'Used CV', NEW_CV: 'New CV', REFINANCE: 'Refinance' };
const FORWARD_ICON: Record<string, typeof Check> = { DOCUMENTS_PENDING: FilePlus2, LOGGED_IN: LogIn, CREDIT_REVIEW: SearchCheck, SANCTIONED: BadgeCheck, DISBURSED: Banknote, CLOSED: Check };

function daysUntil(date: string): number {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

// §10.8 workflow stepper: forward path with dates; a rejected/withdrawn loan stops at its last step.
function WorkflowStepper({ loan }: { loan: LoanDetail }) {
  const terminal = loan.loanStatus === 'REJECTED' || loan.loanStatus === 'WITHDRAWN';
  const order = WORKFLOW_STEPS as readonly string[];
  const currentIdx = terminal ? -1 : order.indexOf(loan.loanStatus);
  const reachedDates: Record<string, string | null> = {
    LOGGED_IN: loan.loggedInDate, SANCTIONED: loan.sanctionDate, DISBURSED: loan.disbursalDate, CLOSED: loan.closedDate,
  };
  // For a stopped loan, the last reached step is the furthest one with a date.
  const stoppedAt = terminal ? Math.max(-1, ...order.map((s, i) => (reachedDates[s] ? i : -1))) : -1;
  const done = (i: number) => (terminal ? i <= stoppedAt : i < currentIdx || (i === currentIdx && loan.loanStatus === 'CLOSED'));

  return (
    <ol aria-label="Loan progress" className="-mx-4 flex overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      {order.map((step, i) => {
        const isCurrent = !terminal && i === currentIdx && loan.loanStatus !== 'CLOSED';
        const isDone = done(i);
        const info = getStatus(step, 'loan');
        return (
          <li key={step} className="flex min-w-28 flex-1 items-start gap-2" aria-current={isCurrent ? 'step' : undefined}>
            <div className="flex w-full flex-col">
              <div className="flex items-center">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-micro',
                    isDone && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary-subtle text-primary',
                    !isDone && !isCurrent && 'border-input bg-surface text-muted-foreground',
                  )}
                >
                  {isDone ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {i < order.length - 1 && <span aria-hidden className={cn('mx-1 h-0.5 flex-1', isDone ? 'bg-primary' : 'bg-border')} />}
              </div>
              <span className={cn('mt-1.5 pr-2 text-caption', isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground')}>{info.label}</span>
              {reachedDates[step] && <span className="num text-caption text-muted-foreground">{formatDate(reachedDates[step])}</span>}
            </div>
          </li>
        );
      })}
      {terminal && (
        <li className="flex min-w-28 flex-col">
          <span className={cn('flex size-6 items-center justify-center rounded-full', loan.loanStatus === 'REJECTED' ? 'bg-danger text-danger-foreground' : 'bg-muted-foreground text-surface')}>
            {loan.loanStatus === 'REJECTED' ? <XCircle aria-hidden className="size-3.5" /> : <CircleSlash aria-hidden className="size-3.5" />}
          </span>
          <span className="mt-1.5 text-caption font-medium text-foreground">{getStatus(loan.loanStatus, 'loan').label}</span>
          <span className="num text-caption text-muted-foreground">{formatDate(loan.rejectionWithdrawnDate)}</span>
        </li>
      )}
    </ol>
  );
}

export function LoanDetailView({ loanId, embedded = false }: { loanId: string; embedded?: boolean }) {
  const { hasRight } = useAuth();
  const terms = useTerms();
  const confirm = useConfirm();
  const canEdit = hasRight('loans.edit');
  const { data: loan, links, actions, loading, error, refetch } = useFetch<LoanDetail>(`/api/v1/loans/${loanId}`, [loanId], { staleAfter: DETAIL_STALE_MS });
  const { data: particularTypes } = useFetch<(MasterOption & { particularTypeId: string })[]>('/api/v1/particular-types');
  const { data: counterparties } = useFetch<MasterOption[]>('/api/v1/lender-disbursed-to-options');
  const { data: documentStatuses } = useFetch<DocumentStatus[]>('/api/v1/document-statuses');
  const [dialog, setDialog] = useState<null | 'entry' | 'sanction' | 'disburse' | 'REJECTED' | 'WITHDRAWN'>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [docSaving, setDocSaving] = useState(false);
  const [headroom, setHeadroom] = useState<number | null>(null);

  useRecordTitle(embedded ? null : loan?.applicationNumber);

  if (error && !loan) {
    return <Alert tone="danger" title="This loan didn't load" action={<Button variant="outline" size="sm" icon={RotateCw} onClick={refetch}>Retry</Button>}>{error}</Alert>;
  }
  if (!loan) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isDisbursed = loan.loanStatus === 'DISBURSED';
  const balance = loan.netDisbursedAmount;
  const counterpartyLabel = (code: string) => (counterparties ?? []).find((c) => c.code === code)?.label ?? humanize(code);
  const particularLabel = (code: string) => (particularTypes ?? []).find((c) => c.code === code)?.label ?? humanize(code);

  // Lender disbursed = credits to the broker (R5), compared with the sanction.
  const lenderDisbursed = loan.ledgerEntries
    .filter((e) => e.entryDirection === 'CREDIT' && e.counterparty === terms.brokerCounterpartyCode)
    .reduce((sum, e) => sum + e.amount, 0);
  const differs = loan.sanctionedAmount != null && lenderDisbursed > 0 && lenderDisbursed !== loan.sanctionedAmount;

  const source = { links, actions };
  const state = (target: string): ActionState => resolveAction(source, target.toLowerCase(), {
    legacyAvailable: loan.nextStatuses.includes(target),
    hasRight: canEdit,
  });
  const forward = loan.nextStatuses.filter((s) => s !== 'REJECTED' && s !== 'WITHDRAWN');
  const allForward = ['DOCUMENTS_PENDING', 'LOGGED_IN', 'CREDIT_REVIEW', 'SANCTIONED', 'DISBURSED', 'CLOSED'];
  const forwardStates = allForward.map((t) => ({ target: t, state: state(t) })).filter((f) => f.state.visible);
  const primaryTarget = forward[forward.length > 1 && forward[0] === 'DOCUMENTS_PENDING' ? 1 : 0] ?? forwardStates[0]?.target;
  const secondaryForward = forwardStates.filter((f) => f.target !== primaryTarget);
  const rejectState = state('REJECTED');
  const withdrawState = state('WITHDRAWN');
  const entryState: ActionState = isDisbursed
    ? resolveAction(source, 'add-line-item', { legacyAvailable: true, hasRight: canEdit })
    : { visible: true, available: false, reason: 'Ledger entries can be added once the loan is disbursed.' };
  const showEntryButton = canEdit && !['REJECTED', 'WITHDRAWN', 'CLOSED'].includes(loan.loanStatus);

  const openSanction = async () => {
    setHeadroom(null);
    setDialog('sanction');
    try {
      const raw = await apiGet<{ data?: CustomerSummary } & CustomerSummary>(`/api/v1/customers/${loan.customerId}`);
      const c = raw?.data ?? raw;
      if (c?.assignedCeiling != null) setHeadroom(Math.max(0, c.assignedCeiling - c.currentUtilization));
    } catch {
      // Headroom hint is optional.
    }
  };

  const runStage = async (target: string) => {
    if (target === 'SANCTIONED') return void openSanction();
    if (target === 'DISBURSED') return setDialog('disburse');
    if (target === 'REJECTED' || target === 'WITHDRAWN') return setDialog(target);
    const label = STAGE_ACTION_LABELS[target] ?? humanize(target);
    const ok = await confirm({ title: `${label}?`, description: STAGE_CONSEQUENCE[target], confirmLabel: label });
    if (!ok) return;
    setRunning(target);
    try {
      await apiPost(`/api/v1/loans/${loan.loanId}/status`, { targetStatus: target, reason: null });
      toast.success(`Loan moved to ${getStatus(target, 'loan').label.toLowerCase()}`);
      await refetch();
    } catch (err) {
      notifyError(err, "The loan status didn't change");
    } finally {
      setRunning(null);
    }
  };

  // Save on change with undo (§11.2).
  const saveDocumentStatus = async (statusId: string, undoTo?: string | null) => {
    const previous = loan.postDisbursementDocumentStatusId;
    setDocSaving(true);
    try {
      await apiPatch(`/api/v1/loans/${loan.loanId}/document-status`, { documentStatusId: statusId || null });
      await refetch();
      if (undoTo === undefined) {
        toast.success('Document status updated', {
          duration: 5000,
          action: { label: 'Undo', onClick: () => void saveDocumentStatus(previous ?? '', null) },
        });
      }
    } catch (err) {
      notifyError(err, "The document status wasn't saved");
    } finally {
      setDocSaving(false);
    }
  };

  const rcTone: Tone = loan.rcAgingStatus ? getStatus(loan.rcAgingStatus).tone : 'neutral';
  const pddDays = loan.pddDueDate ? daysUntil(loan.pddDueDate) : null;
  const pddTone: Tone | undefined = pddDays == null || isDisbursed === false ? undefined : pddDays < 0 ? 'danger' : pddDays < 7 ? 'warning' : undefined;

  const ledgerRows: LedgerRow[] = loan.ledgerEntries.map((e) => ({
    id: e.lineItemId,
    date: e.entryDate,
    direction: e.entryDirection,
    counterparty: e.counterparty,
    particular: e.entryDirection === 'DEBIT' ? e.particularType : null,
    mode: e.modeOfPayment,
    bank: e.bankName,
    accountNo: e.accountNo,
    txnId: e.transactionId,
    credit: e.entryDirection === 'CREDIT' ? e.amount : null,
    debit: e.entryDirection === 'DEBIT' ? e.amount : null,
    balance: e.runningBalanceAmt,
    balanceUnchanged: e.entryDirection === 'CREDIT' && e.counterparty !== terms.brokerCounterpartyCode,
  }));

  const events: ActivityEvent[] = [
    loan.loggedInDate && { id: 'logged', at: loan.loggedInDate, icon: LogIn, text: 'Logged in with the lender' },
    loan.sanctionDate && { id: 'sanction', at: loan.sanctionDate, icon: BadgeCheck, text: `Sanctioned for ${formatINR(loan.sanctionedAmount, { whole: true })}` },
    loan.disbursalDate && { id: 'disburse', at: loan.disbursalDate, icon: Banknote, text: 'Disbursed' },
    ...loan.ledgerEntries.map((e) => ({
      id: e.lineItemId, at: e.entryDate, icon: ArrowRightLeft,
      text: `${e.entryDirection === 'CREDIT' ? 'Credit' : 'Debit'} of ${formatINR(e.amount)} · ${counterpartyLabel(e.counterparty)}`,
    })),
    loan.closedDate && { id: 'closed', at: loan.closedDate, icon: Check, text: 'Closed' },
    loan.rejectionWithdrawnDate && { id: 'stop', at: loan.rejectionWithdrawnDate, icon: XCircle, text: `${getStatus(loan.loanStatus, 'loan').label}: ${loan.rejectionWithdrawnReason ?? ''}` },
  ].filter(Boolean) as ActivityEvent[];

  const primaryState = primaryTarget ? state(primaryTarget) : null;
  const primaryButton = primaryTarget && primaryState && (
    <ActionButton
      state={primaryState}
      icon={FORWARD_ICON[primaryTarget]}
      busy={running !== null}
      loading={running === primaryTarget}
      onClick={() => void runStage(primaryTarget)}
    >
      {STAGE_ACTION_LABELS[primaryTarget]}
    </ActionButton>
  );

  const overflow: MenuAction[] = [
    ...secondaryForward.map((f) => ({
      label: STAGE_ACTION_LABELS[f.target],
      onSelect: () => void runStage(f.target),
      disabled: !f.state.visible || !('available' in f.state) || !f.state.available,
      disabledReason: f.state.visible && 'reason' in f.state ? f.state.reason : undefined,
    })),
  ];

  const actionsBar = (
    <>
      <Tooltip content="Refresh">
        <Button variant="ghost" size="icon" aria-label="Refresh loan" onClick={() => void refetch()} loading={loading}><RotateCw /></Button>
      </Tooltip>
      <ActionMenu actions={overflow} />
      <ActionButton state={withdrawState} variant="outline-danger" busy={running !== null} onClick={() => void runStage('WITHDRAWN')}>Withdraw</ActionButton>
      <ActionButton state={rejectState} variant="outline-danger" busy={running !== null} onClick={() => void runStage('REJECTED')}>Reject</ActionButton>
      {primaryButton}
    </>
  );

  const overview = (
    <div className="space-y-4">
      <Card title="Terms">
        <DescriptionList
          columns={4}
          items={[
            { label: 'Requested', value: <span className="num">{formatINR(loan.requestedAmount)}</span> },
            { label: 'Sanctioned', value: loan.sanctionedAmount == null ? <Empty>Not sanctioned</Empty> : <span className="num">{formatINR(loan.sanctionedAmount)}</span> },
            { label: 'Tenure', value: loan.tenureMonths ? `${loan.tenureMonths} months` : <Empty /> },
            { label: 'Customer rate', value: loan.customerRate ? <span className="num">{formatPercent(loan.customerRate)}</span> : <Empty /> },
            { label: 'EMI', value: loan.emiStartDate ? <span className="num">From {formatDate(loan.emiStartDate)}, day {loan.emiDueDay}</span> : <Empty /> },
            { label: 'Product', value: PRODUCT_LABEL[loan.productType] ?? humanize(loan.productType) },
            { label: 'Agreement #', value: loan.lenderAgreementNumber ? <span className="id-mono">{loan.lenderAgreementNumber}</span> : <Empty /> },
          ]}
        />
      </Card>
      <Card title="Dates">
        <DescriptionList
          columns={4}
          items={[
            { label: 'Logged in', value: <span className="num">{formatDate(loan.loggedInDate)}</span> },
            { label: 'Sanctioned', value: <span className="num">{formatDate(loan.sanctionDate)}</span> },
            { label: 'Disbursed', value: <span className="num">{formatDate(loan.disbursalDate)}</span> },
            { label: 'PDD due', value: <span className="num">{formatDate(loan.pddDueDate)}</span> },
            { label: 'Closed', value: <span className="num">{formatDate(loan.closedDate)}</span>, hidden: !loan.closedDate },
          ]}
        />
      </Card>
      <Card title="RC and documents">
        <DescriptionList
          columns={3}
          items={[
            { label: 'RC stage', value: loan.rcStage ? <StatusBadge status={loan.rcStage} /> : <Empty>Not started</Empty> },
            { label: 'RC aging', value: loan.rcAgingDays != null ? <span className={cn('num', TONE_TEXT[rcTone])}>{formatDays(loan.rcAgingDays)}</span> : <Empty /> },
            {
              label: 'Post-disbursement documents',
              value: isDisbursed && canEdit ? (
                <Select
                  aria-label="Post-disbursement document status"
                  value={loan.postDisbursementDocumentStatusId ?? ''}
                  onValueChange={(v) => void saveDocumentStatus(v)}
                  disabled={docSaving}
                  placeholder="Choose a status"
                  options={(documentStatuses ?? []).filter((d) => d.isActive).map((d) => ({ value: d.documentStatusId, label: d.label }))}
                  className="max-w-64"
                />
              ) : loan.postDisbursementDocumentStatusLabel ?? <Empty />,
            },
          ]}
        />
      </Card>
      <Card title="Payout">
        <div className="num flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {[
            ['Payout', loan.bankPayoutPctAmt],
            ['Bonus', loan.bonusPayoutAmt],
            ['Shared', loan.sharedPayoutAmt],
          ].map(([label, value], i) => (
            <span key={label as string} className="flex items-center gap-3">
              {i > 0 && <span aria-hidden className="text-muted-foreground">{i === 2 ? '−' : '+'}</span>}
              <span className="rounded-md bg-muted px-3 py-2">
                <span className="block text-caption text-muted-foreground">{label}</span>
                <span className="text-foreground">{formatINR(value as number)}</span>
              </span>
            </span>
          ))}
          <span aria-hidden className="text-muted-foreground">=</span>
          <span className="rounded-md border-2 border-primary/40 px-3 py-2">
            <span className="block text-caption text-muted-foreground">Total earned</span>
            <span className="font-semibold text-foreground">{formatINR(loan.totalPayoutEarned)}</span>
          </span>
        </div>
      </Card>
      {loan.remarks && (
        <Card title="Remarks"><p className="whitespace-pre-wrap text-sm text-foreground">{loan.remarks}</p></Card>
      )}
    </div>
  );

  const addEntryButton = showEntryButton && (
    <ActionButton state={entryState} icon={Plus} size="sm" onClick={() => setDialog('entry')}>Add entry</ActionButton>
  );

  return (
    <>
      <RecordHeader
        title={<span className="id-mono">{loan.applicationNumber}</span>}
        badges={<StatusBadge status={loan.loanStatus} domain="loan" />}
        meta={
          <>
            <Link to={`/customers/${loan.customerId}`} className="text-foreground hover:underline">{loan.customerName}</Link>
            <MetaSep />
            <span className="id-mono">{formatRegNo(loan.vehicleRegNo)}</span>
            <MetaSep />
            <span>{loan.lenderName}</span>
            <MetaSep />
            <span>{PRODUCT_LABEL[loan.productType] ?? humanize(loan.productType)}</span>
          </>
        }
        actions={actionsBar}
      />
      <BlockedReasons
        states={[
          { label: 'Reject', state: rejectState },
          { label: 'Withdraw', state: withdrawState },
          ...(primaryTarget && primaryState ? [{ label: STAGE_ACTION_LABELS[primaryTarget], state: primaryState }] : []),
        ]}
      />

      {(loan.loanStatus === 'REJECTED' || loan.loanStatus === 'WITHDRAWN') && (
        <Alert tone={loan.loanStatus === 'REJECTED' ? 'danger' : 'info'} className="mb-4" title={`${getStatus(loan.loanStatus, 'loan').label} on ${formatDate(loan.rejectionWithdrawnDate)}`}>
          {loan.rejectionWithdrawnReason || 'No reason recorded.'}
        </Alert>
      )}

      <div className="mb-5 rounded-lg border bg-surface px-4 py-4"><WorkflowStepper loan={loan} /></div>

      <div className="mb-5">
        <MetricStrip columns={5}>
          <MetricCard label="Sanctioned" value={loan.sanctionedAmount == null ? 'Not sanctioned' : formatINR(loan.sanctionedAmount, { whole: true })} />
          <MetricCard label={terms.brokerLedgerName} value={formatINR(balance)} context={balance < 0 ? 'Negative balance' : undefined} contextTone={balance < 0 ? 'danger' : undefined} />
          <MetricCard
            label="Lender disbursed"
            value={formatINR(lenderDisbursed, { whole: true })}
            context={differs ? `Differs from sanctioned ${formatINR(loan.sanctionedAmount, { whole: true })}` : 'From credits'}
            contextTone={differs ? 'warning' : undefined}
          />
          <MetricCard
            label="RC aging"
            value={loan.rcAgingDays != null ? formatDays(loan.rcAgingDays) : EMPTY}
            context={loan.rcAgingStatus ? getStatus(loan.rcAgingStatus).label : 'Starts at disbursal'}
            contextTone={loan.rcAgingStatus ? rcTone : undefined}
          />
          <MetricCard
            label="PDD due"
            value={formatDate(loan.pddDueDate)}
            context={pddDays == null ? undefined : pddDays < 0 ? `${formatDays(-pddDays)} overdue` : `In ${formatDays(pddDays)}`}
            contextTone={pddTone}
          />
        </MetricStrip>
      </div>

      <Tabs
        param={embedded ? null : 'tab'}
        tabs={[
          { value: 'overview', label: 'Overview', content: overview },
          {
            value: 'ledger',
            label: 'Ledger',
            count: loan.ledgerEntries.length,
            content: (
              <Card flush title="Ledger" actions={addEntryButton}>
                <LedgerTable
                  rows={ledgerRows}
                  counterpartyLabel={counterpartyLabel}
                  particularLabel={particularLabel}
                  closingBalance={balance}
                  emptyDescription={isDisbursed ? "Add the bank's credit to start the ledger." : 'Entries can be added once the loan is disbursed.'}
                />
              </Card>
            ),
          },
          {
            value: 'activity',
            label: 'Activity',
            count: events.length,
            content: <Card><ActivityThread events={events} /></Card>,
          },
        ]}
      />

      {!embedded && (
        <StickyActionDock>
          {primaryButton}
          {isDisbursed && showEntryButton && <ActionButton state={entryState} icon={Plus} variant="outline" onClick={() => setDialog('entry')}>Add entry</ActionButton>}
          {(rejectState.visible || withdrawState.visible || overflow.length > 0) && (
            <ActionMenu
              trigger={<Button variant="outline" size="icon" aria-label="More actions" className="!flex-none"><MoreHorizontal /></Button>}
              actions={[
                ...overflow,
                { label: 'Withdraw', danger: true, hidden: !withdrawState.visible, disabled: withdrawState.visible && !withdrawState.available, onSelect: () => void runStage('WITHDRAWN') },
                { label: 'Reject', danger: true, hidden: !rejectState.visible, disabled: rejectState.visible && !rejectState.available, onSelect: () => void runStage('REJECTED') },
              ]}
            />
          )}
        </StickyActionDock>
      )}

      <LedgerEntryDialog
        open={dialog === 'entry'}
        onOpenChange={(o) => setDialog(o ? 'entry' : null)}
        loan={loan}
        onDone={() => void refetch()}
        counterparties={counterparties ?? []}
        particularTypes={particularTypes ?? []}
      />
      <SanctionDialog open={dialog === 'sanction'} onOpenChange={(o) => setDialog(o ? 'sanction' : null)} loan={loan} onDone={() => void refetch()} headroom={headroom} />
      <DisburseDialog open={dialog === 'disburse'} onOpenChange={(o) => setDialog(o ? 'disburse' : null)} loan={loan} onDone={() => void refetch()} onAddCredit={() => setDialog('entry')} />
      {(dialog === 'REJECTED' || dialog === 'WITHDRAWN') && (
        <ReasonDialog open onOpenChange={(o) => !o && setDialog(null)} loan={loan} onDone={() => void refetch()} target={dialog} />
      )}
    </>
  );
}

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <LoanDetailView loanId={id!} />;
}

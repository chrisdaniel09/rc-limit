import { useEffect, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { apiPost } from '@/api/client';
import StatusBadge from '@/components/StatusBadge';
import { IntegerInput } from '@/components/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/feedback';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import { ACTION_LABELS, ACTION_TAKES_SCORE, AUTOMATED_FIELDS, OUTCOME_OPTIONS, type ActionRun } from './productTypes';
import type { LeadDetail } from './leadShared';

export type ResultMode = 'manual' | 'automated' | 'history';

interface RecordResultSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadDetail;
  actionCode: string;
  mode: ResultMode;
  onModeChange: (mode: ResultMode) => void;
  canEdit: boolean;
  onRecorded: () => void;
}

// §10.4 Record result (side sheet): Manual / Automated / History for one check.
export default function RecordResultSheet({ open, onOpenChange, lead, actionCode, mode, onModeChange, canEdit, onRecorded }: RecordResultSheetProps) {
  const label = ACTION_LABELS[actionCode] ?? actionCode;
  const takesScore = ACTION_TAKES_SCORE[actionCode];
  const [outcome, setOutcome] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [remarks, setRemarks] = useState('');
  const [outcomeError, setOutcomeError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOutcome('');
    setScore(null);
    setRemarks('');
    setOutcomeError(undefined);
    setServerError(null);
  }, [open, actionCode]);

  const runs: ActionRun[] = lead.actionHistory.filter((r) => r.actionCode === actionCode);

  // Values an automated check would send, prefilled from the lead.
  const automatedValues: Record<string, string> = {
    pan: '',
    mobile: lead.whatsappPhoneNumber ?? '',
    fullName: lead.applicantName ?? '',
    registration: lead.referenceNumber ?? '',
  };
  const automatedFields = AUTOMATED_FIELDS[actionCode] ?? [];

  const save = async () => {
    if (!outcome) {
      setOutcomeError('Choose an outcome');
      return;
    }
    const request: Record<string, unknown> = { outcome };
    if (takesScore && score != null) request.score = score;
    if (remarks.trim()) request.remarks = remarks.trim();
    setSaving(true);
    setServerError(null);
    try {
      const response = await apiPost<{ data: ActionRun[] }>(`/api/v1/leads/${lead.leadId}/actions`, { [actionCode]: request });
      const failed = response.data?.find((run) => run.status === 'FAILED');
      onRecorded();
      if (failed) {
        setServerError(`${label} wasn't recorded: ${failed.error ?? 'unknown error'}`);
      } else {
        notifySuccess(`${label} recorded`);
        onOpenChange(false);
      }
    } catch (err) {
      setServerError(errorMessage(err, `${label} wasn't recorded.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      size="md"
      title={label}
      description="Record a result, or see earlier runs."
      error={serverError}
      dirty={mode === 'manual' && (outcome !== '' || remarks !== '')}
      onSubmit={mode === 'manual' ? () => void save() : undefined}
      footer={
        mode === 'manual' ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              loading={saving}
              loadingText="Saving…"
              disabledReason={!canEdit ? (lead.isLocked ? 'This lead is converted, so its checks are locked.' : "You don't have permission to record checks.") : undefined}
            >
              Record result
            </Button>
          </>
        ) : mode === 'automated' ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button disabledReason="Automated checks are not connected yet.">Run check</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        )
      }
    >
      <Segmented<ResultMode>
        aria-label="Mode"
        value={mode}
        onValueChange={onModeChange}
        options={[{ value: 'manual', label: 'Manual' }, { value: 'automated', label: 'Automated' }, { value: 'history', label: `History (${runs.length})` }]}
        className="mb-5 w-full"
      />

      {mode === 'manual' && (
        <div className="space-y-4">
          {!canEdit && (
            <Alert tone="warning">{lead.isLocked ? 'This lead is converted, so its checks are locked.' : "You don't have permission to record checks."}</Alert>
          )}
          <Field label="Outcome" required error={outcomeError}>
            <Segmented
              aria-label="Outcome"
              value={outcome}
              onValueChange={(v) => {
                setOutcome(v);
                setOutcomeError(undefined);
              }}
              options={OUTCOME_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              disabled={!canEdit}
              className="w-full"
            />
          </Field>
          {takesScore && (
            <Field label="Score" optional hint="CIBIL scores run from 300 to 900.">
              <IntegerInput value={score} onValueChange={setScore} min={300} max={900} disabled={!canEdit} placeholder="750" />
            </Field>
          )}
          <Field label="Remarks" optional>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes about this check" maxLength={1000} disabled={!canEdit} />
          </Field>
        </div>
      )}

      {mode === 'automated' && (
        <div className="space-y-4">
          <Alert tone="info">Automated checks are not connected yet, so nothing is sent to the provider.</Alert>
          <p className="text-label text-muted-foreground">Fields the provider needs</p>
          <ul className="divide-y rounded-lg border">
            {automatedFields.map((f) => {
              const value = automatedValues[f.key];
              const missing = f.required && !value?.trim();
              return (
                <li key={f.key} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  {missing ? (
                    <span className="inline-flex items-center gap-1 text-warning"><CircleAlert aria-hidden className="size-4" />Missing</span>
                  ) : (
                    <span className="truncate font-medium text-foreground">{value}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mode === 'history' && (runs.length === 0 ? (
        <EmptyState title="No results recorded" description={`Results for the ${label.toLowerCase()} show up here.`} />
      ) : (
        <ol className="space-y-3">
          {runs.map((run) => (
            <li key={run.executionId} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="num text-caption text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                {run.status === 'FAILED' ? <StatusBadge status="FAILED" domain="check" /> : <StatusBadge status={run.response?.outcome} domain="check" />}
              </div>
              {run.status === 'FAILED' ? (
                <p className="mt-1 text-danger">Not recorded: {run.error ?? 'unknown error'}</p>
              ) : (
                <p className="mt-1 text-foreground">
                  {run.response?.score != null && <span className="num">Score {run.response.score}</span>}
                  {run.response?.score != null && run.response?.remarks && ' · '}
                  {run.response?.remarks}
                </p>
              )}
            </li>
          ))}
        </ol>
      ))}
    </ResponsiveDialog>
  );
}

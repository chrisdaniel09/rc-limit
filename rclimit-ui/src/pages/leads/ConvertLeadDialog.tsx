import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, UserRound } from 'lucide-react';
import { apiGet, apiPost } from '@/api/client';
import Badge from '@/components/Badge';
import { CurrencyInput } from '@/components/inputs';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox, RadioCards, Segmented } from '@/components/ui/choice';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/feedback';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { formatDate, formatINR, formatPhone, formatRegNo } from '@/lib/format';
import { searchCustomers } from '@/lib/lookups';
import type { Tone } from '@/lib/status';
import { CUSTOMER_TYPES } from '../customers/customerShared';
import { ROLE_OPTIONS } from './productTypes';
import type { LeadDetail } from './leadShared';

interface CustomerMatch {
  customerId: string;
  legalName: string;
  phoneNumber: string | null;
  matchedOn: string;
  matchReasons: string[];
  vehicleCount: number;
  previousLeadCount: number;
  lastLeadAt: string | null;
}

type ConflictChoice = 'LEAD' | 'VEHICLE';

interface VehiclePreview {
  registrationNumber: string;
  status: 'NEW' | 'SAME_OWNER' | 'OWNED_BY_OTHER' | 'BLOCKED' | string;
  currentOwnerName: string | null;
  conflicts: { role: string; field: string; currentValue: string | null; leadValue: string | null }[];
}

interface ConversionPreview {
  customerMatches: CustomerMatch[];
  vehicle: VehiclePreview | null;
}

const REASON_TONE: Record<string, Tone> = { PHONE: 'info', VEHICLE: 'success', NAME: 'warning' };

type Step = 'customer' | 'vehicle' | 'review';

// §10.4 Convert to customer: Customer → Vehicle (when the requirement has one) → Review.
export default function ConvertLeadDialog({ open, onOpenChange, lead, onConverted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadDetail;
  onConverted: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('customer');
  const [mode, setMode] = useState<'new' | 'existing' | ''>('');
  const [customerType, setCustomerType] = useState('DEALER');
  const [ceiling, setCeiling] = useState<number | null>(null);
  const [existing, setExisting] = useState<{ customerId: string; legalName: string } | null>(null);
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, ConflictChoice>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  const loadPreview = async (customerId?: string) => {
    setLoadingPreview(true);
    try {
      const res = await apiGet<{ data: ConversionPreview }>(`/api/v1/leads/${lead.leadId}/conversion-preview${customerId ? `?customerId=${customerId}` : ''}`);
      setPreview(res.data);
    } catch (err) {
      setServerError(errorMessage(err, "The conversion preview didn't load."));
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep('customer');
    setMode('');
    setCustomerType('DEALER');
    setCeiling(null);
    setExisting(null);
    setConfirmTransfer(false);
    setDecisions({});
    setStepError(null);
    setServerError(null);
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const vehicle = preview?.vehicle ?? null;
  const steps: Step[] = vehicle ? ['customer', 'vehicle', 'review'] : ['customer', 'review'];
  const stepIndex = steps.indexOf(step);
  const undecided = (vehicle?.conflicts ?? []).filter((c) => !decisions[c.role]);
  const blocked = vehicle?.status === 'BLOCKED';
  const needsTransfer = vehicle?.status === 'OWNED_BY_OTHER';

  const chooseExisting = (c: { customerId: string; legalName: string }) => {
    setExisting(c);
    setConfirmTransfer(false);
    setStepError(null);
    void loadPreview(c.customerId);
  };

  const validateStep = (): string | null => {
    if (step === 'customer') {
      if (!mode) return 'Choose a new or an existing customer.';
      if (mode === 'new' && (!ceiling || ceiling <= 0)) return 'Enter the sub-limit ceiling for the new customer.';
      if (mode === 'existing' && !existing) return 'Choose the existing customer.';
    }
    if (step === 'vehicle') {
      if (blocked) return 'This vehicle has an open loan, so it can’t be transferred.';
      if (needsTransfer && !confirmTransfer) return 'Confirm the vehicle transfer to continue.';
      if (undecided.length) return `Choose which value to keep for: ${undecided.map((c) => c.field).join(', ')}.`;
    }
    return null;
  };

  const next = () => {
    const problem = validateStep();
    setStepError(problem);
    if (problem) return;
    setStep(steps[stepIndex + 1]);
  };

  const convert = async () => {
    setConverting(true);
    setServerError(null);
    try {
      const payload: Record<string, unknown> = { maxPendingRcAllowed: 5 };
      if (mode === 'new') {
        payload.customerType = customerType;
        payload.assignedCeiling = ceiling;
      } else {
        payload.existingCustomerId = existing!.customerId;
        payload.confirmVehicleTransfer = confirmTransfer;
      }
      if (vehicle) payload.conflictDecisions = decisions;
      const res = await apiPost<{ data: { customerId: string } }>(`/api/v1/leads/${lead.leadId}/convert`, payload);
      notifySuccess('Lead converted');
      onOpenChange(false);
      onConverted();
      navigate(`/customers/${res.data.customerId}`);
    } catch (err) {
      // The server's message carries the business rule (for example, an open loan blocks the transfer).
      setServerError(errorMessage(err, "The lead wasn't converted."));
    } finally {
      setConverting(false);
    }
  };

  const stepLabels: Record<Step, string> = { customer: 'Customer', vehicle: 'Vehicle', review: 'Review' };

  const stepper = (
    <ol className="mb-5 flex items-center gap-2" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={s === step ? 'step' : undefined}>
          <span className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-micro',
            i < stepIndex ? 'bg-primary text-primary-foreground' : i === stepIndex ? 'border-2 border-primary text-primary' : 'border-2 border-input text-muted-foreground',
          )}>
            {i < stepIndex ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
          </span>
          <span className={cn('text-sm', i === stepIndex ? 'font-medium text-foreground' : 'text-muted-foreground')}>{stepLabels[s]}</span>
          {i < steps.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );

  const customerStep = (
    <div className="space-y-4">
      <RadioCards<'new' | 'existing'>
        aria-label="Customer"
        value={mode}
        onValueChange={(v) => {
          setMode(v);
          setStepError(null);
          if (v === 'new') {
            setExisting(null);
            void loadPreview();
          }
        }}
        options={[
          { value: 'new', title: 'New customer', icon: <Plus aria-hidden className="size-4" />, description: 'Set the customer type and sub-limit ceiling.' },
          { value: 'existing', title: 'Existing customer', icon: <UserRound aria-hidden className="size-4" />, description: 'Link to a customer by phone, vehicle or name.' },
        ]}
      />
      {mode === 'new' && (
        <div className="space-y-4 rounded-lg border p-4">
          <Field label="Customer type" required>
            <Segmented aria-label="Customer type" value={customerType} onValueChange={setCustomerType} options={CUSTOMER_TYPES} />
          </Field>
          <Field label="Sub-limit ceiling" required>
            <CurrencyInput value={ceiling} onValueChange={setCeiling} showWords />
          </Field>
        </div>
      )}
      {mode === 'existing' && (
        <div className="space-y-3">
          <p className="text-label text-muted-foreground">Suggested matches</p>
          {loadingPreview && !preview ? (
            <Skeleton className="h-20 w-full" />
          ) : preview && preview.customerMatches.length > 0 ? (
            <ul className="space-y-2">
              {preview.customerMatches.map((m) => {
                const selected = existing?.customerId === m.customerId;
                return (
                  <li key={m.customerId}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseExisting(m)}
                      className={cn('w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50', selected && 'border-primary bg-primary-subtle')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{m.legalName}</p>
                          <p className="num text-caption text-muted-foreground">{formatPhone(m.phoneNumber)}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          {m.matchReasons.map((r) => <Badge key={r} text={`${r.charAt(0)}${r.slice(1).toLowerCase()} match`} variant={REASON_TONE[r] ?? 'neutral'} />)}
                        </div>
                      </div>
                      <p className="num mt-2 text-caption text-muted-foreground">
                        {m.vehicleCount} vehicles · {m.previousLeadCount} earlier leads{m.lastLeadAt && ` · last ${formatDate(m.lastLeadAt)}`}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No suggested customers. Search below.</p>
          )}
          <Field label="Or search all customers">
            <Combobox
              value={existing?.customerId ?? ''}
              onValueChange={(v, option) => option && chooseExisting({ customerId: v, legalName: option.label })}
              search={searchCustomers}
              selectedLabel={existing?.legalName}
              placeholder="Search by name or phone"
            />
          </Field>
        </div>
      )}
    </div>
  );

  const vehicleStep = vehicle && (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <div>
          <p className="text-caption text-muted-foreground">Vehicle</p>
          <p className="id-mono text-base font-medium">{formatRegNo(vehicle.registrationNumber)}</p>
        </div>
        <Badge
          text={{ NEW: 'New vehicle', SAME_OWNER: 'Already owned', OWNED_BY_OTHER: 'Transfer', BLOCKED: 'Transfer blocked' }[vehicle.status] ?? vehicle.status}
          variant={{ NEW: 'success', SAME_OWNER: 'info', OWNED_BY_OTHER: 'warning', BLOCKED: 'danger' }[vehicle.status] as Tone ?? 'neutral'}
        />
      </div>
      {vehicle.status === 'NEW' && <p className="text-sm text-muted-foreground">The vehicle will be registered to {mode === 'new' ? 'the new customer' : existing?.legalName}.</p>}
      {vehicle.status === 'SAME_OWNER' && <p className="text-sm text-muted-foreground">{existing?.legalName} already owns this vehicle.</p>}
      {needsTransfer && (
        <Alert tone="warning" title={`Owned by ${vehicle.currentOwnerName ?? 'another customer'}`}>
          <Checkbox
            className="mt-2"
            label="Transfer this vehicle to the selected customer"
            checked={confirmTransfer}
            onCheckedChange={(c) => { setConfirmTransfer(c); setStepError(null); }}
          />
        </Alert>
      )}
      {blocked && <Alert tone="danger" title="Transfer blocked">This vehicle has an open loan, so it can't change owner.</Alert>}
      {vehicle.conflicts.length > 0 && (
        <div className="space-y-2">
          <p className="text-subheading">Vehicle details differ</p>
          <p className="text-caption text-muted-foreground">Choose which value to keep for each field. Blank vehicle fields are filled from the lead.</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-label text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Vehicle</th><th className="px-3 py-2 font-medium">Lead</th><th className="px-3 py-2 font-medium">Keep</th></tr>
              </thead>
              <tbody className="divide-y">
                {vehicle.conflicts.map((c) => (
                  <tr key={c.role}>
                    <td className="px-3 py-2 font-medium">{ROLE_OPTIONS.find((r) => r.value === c.role)?.label ?? c.field}</td>
                    <td className="px-3 py-2">{c.currentValue ?? '—'}</td>
                    <td className="px-3 py-2">{c.leadValue ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Segmented<ConflictChoice>
                        aria-label={`Keep value for ${c.field}`}
                        size="sm"
                        value={decisions[c.role] ?? ('' as ConflictChoice)}
                        onValueChange={(v) => { setDecisions((d) => ({ ...d, [c.role]: v })); setStepError(null); }}
                        options={[{ value: 'VEHICLE', label: 'Vehicle' }, { value: 'LEAD', label: 'Lead' }]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const reviewStep = (
    <dl className="space-y-3 text-sm">
      <div className="rounded-lg border p-4">
        <dt className="text-caption text-muted-foreground">Customer</dt>
        <dd className="mt-1 font-medium">
          {mode === 'new'
            ? <>New {customerType.toLowerCase()} <span className="font-normal text-muted-foreground">from {lead.applicantName}, sub-limit</span> <span className="num">{formatINR(ceiling, { whole: true })}</span></>
            : <>Link to {existing?.legalName}</>}
        </dd>
      </div>
      {vehicle && (
        <div className="rounded-lg border p-4">
          <dt className="text-caption text-muted-foreground">Vehicle</dt>
          <dd className="mt-1">
            <span className="id-mono font-medium">{formatRegNo(vehicle.registrationNumber)}</span>{' '}
            {vehicle.status === 'NEW' && 'will be registered to the customer.'}
            {vehicle.status === 'SAME_OWNER' && 'is already theirs.'}
            {vehicle.status === 'OWNED_BY_OTHER' && `will be transferred from ${vehicle.currentOwnerName ?? 'its current owner'}.`}
            {vehicle.conflicts.length > 0 && <span className="block text-caption text-muted-foreground">{vehicle.conflicts.length} differing fields resolved.</span>}
          </dd>
        </div>
      )}
      <p className="text-caption text-muted-foreground">The lead is locked after conversion.</p>
    </dl>
  );

  const isLast = stepIndex === steps.length - 1;
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Convert lead to customer"
      description={lead.applicantName}
      size="2xl"
      dirty={mode !== ''}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => (stepIndex === 0 ? onOpenChange(false) : setStep(steps[stepIndex - 1]))}>
            {stepIndex === 0 ? 'Cancel' : 'Back'}
          </Button>
          {isLast ? (
            <Button loading={converting} loadingText="Converting…" onClick={() => void convert()}>Convert lead</Button>
          ) : (
            <Button onClick={next} disabledReason={step === 'vehicle' && blocked ? 'This vehicle has an open loan, so it can’t be transferred.' : undefined}>Next</Button>
          )}
        </>
      }
    >
      {stepper}
      {stepError && <Alert tone="danger" className="mb-4" role="alert">{stepError}</Alert>}
      {step === 'customer' && customerStep}
      {step === 'vehicle' && (loadingPreview ? <Skeleton className="h-40 w-full" /> : vehicleStep)}
      {step === 'review' && reviewStep}
    </ResponsiveDialog>
  );
}

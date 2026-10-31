import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { z } from 'zod';
import { apiPost } from '@/api/client';
import { useTerms } from '@/theme/ThemeProvider';
import { CodeInput, CurrencyInput, DateInput, IntegerInput, PercentInput, todayIso } from '@/components/inputs';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { FieldGrid } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';
import { PAYMENT_MODES, STAGE_ACTION_LABELS, type LoanDetail, type MasterOption } from './loanTypes';

interface DialogBase {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanDetail;
  onDone: () => void;
}

function useServerError(open: boolean) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  return [error, setError] as const;
}

// ---------- Add ledger entry (side sheet) ----------

const entrySchema = z.object({
  entryDirection: z.enum(['CREDIT', 'DEBIT']),
  counterparty: z.string().min(1, 'Choose who was paid'),
  particularType: z.string(),
  amount: z.number({ error: 'Enter the amount' }).positive('Enter an amount greater than zero'),
  modeOfPayment: z.string(),
  bankName: z.string().max(100),
  accountNo: z.string().max(40),
  transactionId: z.string().max(80),
}).refine((v) => v.entryDirection === 'CREDIT' || v.particularType !== '', { path: ['particularType'], message: 'Choose the particular type' });

export function LedgerEntryDialog({ open, onOpenChange, loan, onDone, counterparties, particularTypes }: DialogBase & {
  counterparties: MasterOption[];
  particularTypes: MasterOption[];
}) {
  const terms = useTerms();
  const [serverError, setServerError] = useServerError(open);
  const [showBank, setShowBank] = useState(false);
  const form = useZodForm(entrySchema, {
    entryDirection: 'CREDIT', counterparty: terms.brokerCounterpartyCode, particularType: '', amount: null as unknown as number,
    modeOfPayment: '', bankName: '', accountNo: '', transactionId: '',
  });
  const { control, handleSubmit, watch, reset, setValue, formState } = form;

  useEffect(() => {
    if (open) {
      reset();
      setShowBank(false);
    }
  }, [open, reset]);

  const direction = watch('entryDirection');
  const counterparty = watch('counterparty');
  const amount = watch('amount');
  const balance = loan.netDisbursedAmount;
  const directToCustomer = direction === 'CREDIT' && counterparty !== terms.brokerCounterpartyCode;
  const balanceAfter = amount == null ? balance : directToCustomer ? balance : direction === 'CREDIT' ? balance + amount : balance - amount;
  const exceeds = direction === 'DEBIT' && amount != null && amount > balance;

  const submit = handleSubmit(async (v) => {
    if (exceeds) return;
    setServerError(null);
    try {
      await apiPost(`/api/v1/loans/${loan.loanId}/line-items`, {
        entryDirection: v.entryDirection,
        counterparty: v.counterparty,
        particularType: v.entryDirection === 'DEBIT' ? v.particularType : null,
        modeOfPayment: v.modeOfPayment || null,
        bankName: v.bankName || null,
        accountNo: v.accountNo || null,
        transactionId: v.transactionId || null,
        amount: v.amount,
      });
      notifySuccess('Ledger entry added');
      onOpenChange(false);
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, "The ledger entry wasn't added."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="sheet"
      size="md"
      title="Add ledger entry"
      description={<span className="id-mono">{loan.applicationNumber}</span>}
      dirty={formState.isDirty}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Adding…" disabledReason={exceeds ? 'The debit is larger than the balance.' : undefined}>
            Add entry
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          control={control}
          name="entryDirection"
          label="Entry type"
          required
          hint={direction === 'CREDIT' ? 'The bank pays out against this loan.' : `Paid from the ${terms.brokerLedgerName.toLowerCase()}.`}
          render={(f) => (
            <Segmented
              aria-label="Entry type"
              value={f.value}
              onValueChange={(v) => {
                f.onChange(v);
                setValue('particularType', '');
              }}
              options={[{ value: 'CREDIT', label: 'Credit' }, { value: 'DEBIT', label: 'Debit' }]}
              className="w-full"
            />
          )}
        />
        <FormField
          control={control}
          name="counterparty"
          label={direction === 'CREDIT' ? 'Recipient' : 'Payee'}
          required
          render={(f) => (
            <Select value={f.value} onValueChange={f.onChange} options={counterparties.filter((c) => c.isActive).map((c) => ({ value: c.code, label: c.label }))} />
          )}
        />
        {directToCustomer && (
          <Alert tone="info">A credit straight to the customer is recorded but doesn't change the {terms.brokerLedgerName.toLowerCase()}.</Alert>
        )}
        {direction === 'DEBIT' && (
          <FormField
            control={control}
            name="particularType"
            label="Particular type"
            required
            render={(f) => (
              <Select value={f.value} onValueChange={f.onChange} options={particularTypes.filter((t) => t.isActive).map((t) => ({ value: t.code, label: t.label }))} />
            )}
          />
        )}
        <FormField
          control={control}
          name="amount"
          label="Amount"
          required
          render={(f) => (
            <CurrencyInput
              value={f.value ?? null}
              onValueChange={(v) => f.onChange(v as number)}
              onBlur={f.onBlur}
              max={direction === 'DEBIT' ? balance : undefined}
              maxLabel={terms.brokerLedgerName.toLowerCase()}
              showWords
            />
          )}
        />
        <p className="num flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Balance after</span>
          <span className={cn('font-semibold', balanceAfter < 0 ? 'text-danger' : 'text-foreground')}>{formatINR(balanceAfter)}</span>
        </p>
        <FormField
          control={control}
          name="modeOfPayment"
          label="Mode of payment"
          optional
          render={(f) => <Select value={f.value} onValueChange={f.onChange} options={PAYMENT_MODES} placeholder="Choose a mode" clearLabel="Not recorded" />}
        />
        <div className="rounded-lg border">
          <button
            type="button"
            aria-expanded={showBank}
            onClick={() => setShowBank((s) => !s)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground"
          >
            Bank reference <span className="font-normal text-muted-foreground">(optional)</span>
            <ChevronDown aria-hidden className={cn('ml-auto size-4 transition-transform', showBank && 'rotate-180')} />
          </button>
          {showBank && (
            <div className="space-y-4 border-t p-3">
              <FormField control={control} name="bankName" label="Bank" render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
              <FormField control={control} name="accountNo" label="Account no" render={(f) => <CodeInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} inputMode="numeric" />} />
              <FormField control={control} name="transactionId" label="Transaction ID" render={(f) => <CodeInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} placeholder="UTR or cheque no" />} />
            </div>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}

// ---------- Sanction ----------

const sanctionSchema = z.object({
  sanctionedAmount: z.number({ error: 'Enter the sanctioned amount' }).positive('Enter an amount greater than zero'),
  tenureMonths: z.number({ error: 'Enter the tenure' }).int().min(1, 'At least 1 month').max(120, 'At most 120 months'),
  customerRate: z.number({ error: 'Enter the rate' }).min(0).max(60, 'Check the rate'),
  sanctionDate: z.string().min(1, 'Enter the sanction date'),
});

export function SanctionDialog({ open, onOpenChange, loan, onDone, headroom }: DialogBase & { headroom: number | null }) {
  const [serverError, setServerError] = useServerError(open);
  const form = useZodForm(sanctionSchema, {
    sanctionedAmount: loan.requestedAmount, tenureMonths: null as unknown as number, customerRate: null as unknown as number, sanctionDate: todayIso(),
  });
  const { control, handleSubmit, reset, watch, formState } = form;
  useEffect(() => {
    if (open) reset({ sanctionedAmount: loan.requestedAmount, tenureMonths: null as unknown as number, customerRate: null as unknown as number, sanctionDate: todayIso() });
  }, [open, reset, loan.requestedAmount]);

  const amount = watch('sanctionedAmount');
  const overHeadroom = loan.productType === 'USED_CV' && headroom != null && amount != null && amount > headroom;

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await apiPost(`/api/v1/loans/${loan.loanId}/sanction`, v);
      notifySuccess('Loan sanctioned');
      onOpenChange(false);
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, "The loan wasn't sanctioned."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sanction loan"
      description={<span className="id-mono">{loan.applicationNumber}</span>}
      dirty={formState.isDirty}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Sanctioning…">Sanction loan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField
          control={control}
          name="sanctionedAmount"
          label="Sanctioned amount"
          required
          hint={headroom != null && loan.productType === 'USED_CV' ? `Sub-limit headroom ${formatINR(headroom, { whole: true })}` : `Requested ${formatINR(loan.requestedAmount, { whole: true })}`}
          render={(f) => <CurrencyInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} showWords />}
        />
        {overHeadroom && <Alert tone="warning">This is more than the customer's sub-limit headroom. The sanction may be refused.</Alert>}
        <FieldGrid>
          <FormField control={control} name="tenureMonths" label="Tenure (months)" required render={(f) => <IntegerInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} min={1} max={120} />} />
          <FormField control={control} name="customerRate" label="Customer rate" required render={(f) => <PercentInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} />} />
        </FieldGrid>
        <FormField control={control} name="sanctionDate" label="Sanction date" required render={(f) => <DateInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} max={todayIso()} />} />
      </div>
    </ResponsiveDialog>
  );
}

// ---------- Disburse ----------

const disburseSchema = z.object({
  disbursalDate: z.string().min(1, 'Enter the disbursal date'),
  emiStartDate: z.string().min(1, 'Enter the EMI start date'),
  emiDueDay: z.number({ error: 'Enter the EMI due day' }).int().min(1, 'Between 1 and 31').max(31, 'Between 1 and 31'),
}).refine((v) => !v.emiStartDate || !v.disbursalDate || v.emiStartDate >= v.disbursalDate, {
  path: ['emiStartDate'], message: 'EMI start must be on or after the disbursal date',
});

export function DisburseDialog({ open, onOpenChange, loan, onDone, onAddCredit }: DialogBase & { onAddCredit: () => void }) {
  const [serverError, setServerError] = useServerError(open);
  const form = useZodForm(disburseSchema, { disbursalDate: todayIso(), emiStartDate: '', emiDueDay: null as unknown as number });
  const { control, handleSubmit, reset, setValue, getValues, formState } = form;
  useEffect(() => {
    if (open) reset({ disbursalDate: todayIso(), emiStartDate: '', emiDueDay: null as unknown as number });
  }, [open, reset]);

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await apiPost(`/api/v1/loans/${loan.loanId}/disburse`, v);
      notifySuccess('Loan disbursed', {
        description: "Add the bank's credit as a ledger entry.",
        action: { label: 'Add bank credit now', onClick: onAddCredit },
      });
      onOpenChange(false);
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, "The loan wasn't disbursed."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Disburse loan"
      description="Disbursal records the status only. Add the bank's credit as a ledger entry afterwards."
      dirty={formState.isDirty}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Disbursing…">Disburse loan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField control={control} name="disbursalDate" label="Disbursal date" required render={(f) => <DateInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} max={todayIso()} />} />
        <FieldGrid>
          <FormField
            control={control}
            name="emiStartDate"
            label="EMI start date"
            required
            render={(f) => (
              <DateInput
                value={f.value}
                onValueChange={(v) => {
                  f.onChange(v);
                  // Prefill the due day from the start date's day.
                  if (v && getValues('emiDueDay') == null) setValue('emiDueDay', Number(v.slice(8, 10)), { shouldValidate: true });
                }}
                onBlur={f.onBlur}
                min={getValues('disbursalDate') || undefined}
              />
            )}
          />
          <FormField control={control} name="emiDueDay" label="EMI due day" required hint="Day of the month, 1–31" render={(f) => <IntegerInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} min={1} max={31} />} />
        </FieldGrid>
      </div>
    </ResponsiveDialog>
  );
}

// ---------- Reject / withdraw ----------

const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason').max(500) });

export function ReasonDialog({ open, onOpenChange, loan, onDone, target }: DialogBase & { target: 'REJECTED' | 'WITHDRAWN' }) {
  const [serverError, setServerError] = useServerError(open);
  const form = useZodForm(reasonSchema, { reason: '' });
  const { control, handleSubmit, reset, formState } = form;
  useEffect(() => {
    if (open) reset({ reason: '' });
  }, [open, reset]);
  const verb = STAGE_ACTION_LABELS[target];

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      await apiPost(`/api/v1/loans/${loan.loanId}/status`, { targetStatus: target, reason: v.reason });
      notifySuccess(target === 'REJECTED' ? 'Loan rejected' : 'Loan withdrawn');
      onOpenChange(false);
      onDone();
    } catch (err) {
      setServerError(errorMessage(err, "The loan status didn't change."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${verb} loan?`}
      description={target === 'REJECTED' ? 'A rejected loan is closed and takes no further steps.' : 'A withdrawn loan is closed and takes no further steps.'}
      size="md"
      dirty={formState.isDirty}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="danger" loading={formState.isSubmitting} loadingText={target === 'REJECTED' ? 'Rejecting…' : 'Withdrawing…'}>{verb} loan</Button>
        </>
      }
    >
      <FormField control={control} name="reason" label="Reason" required render={(f) => <Textarea value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} maxLength={500} rows={3} autoFocus />} />
    </ResponsiveDialog>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { apiPost } from '@/api/client';
import { useFetch } from '@/hooks/useFetch';
import { CurrencyInput } from '@/components/inputs';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { UtilizationMeter } from '@/components/metrics';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { Combobox, type ComboOption } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { FieldGrid, FormSection } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { formatINR } from '@/lib/format';
import { customerVehicles, searchCustomers, searchPartners, type CustomerHit } from '@/lib/lookups';
import { PRODUCT_TYPES } from './loanTypes';

interface BankPool {
  poolId: string;
  lenderName: string;
  facilityAccountNumber: string;
  sanctionedLimit: number;
  utilizedAmount: number;
}

const amount = z.number({ error: 'Enter an amount' }).min(0, 'Amount can’t be negative');

const schema = z.object({
  customerId: z.string().min(1, 'Choose a customer'),
  vehicleId: z.string().min(1, 'Choose a vehicle'),
  poolId: z.string().min(1, 'Choose a bank pool'),
  productType: z.enum(['USED_CV', 'NEW_CV', 'REFINANCE']),
  requestedAmount: z.number({ error: 'Enter the requested amount' }).positive('Enter an amount greater than zero'),
  lenderAgreementNumber: z.string().max(60),
  partnerId: z.string(),
  bankPayoutPctAmt: amount,
  bonusPayoutAmt: amount,
  sharedPayoutAmt: amount,
  remarks: z.string().max(1000),
});

type FormValues = z.input<typeof schema>;

const DEFAULTS: FormValues = {
  customerId: '', vehicleId: '', poolId: '', productType: 'USED_CV', requestedAmount: null as unknown as number,
  lenderAgreementNumber: '', partnerId: '', bankPayoutPctAmt: 0, bonusPayoutAmt: 0, sharedPayoutAmt: 0, remarks: '',
};

interface CreateLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (loanId: string | null) => void;
  // Prefill from a customer page.
  customer?: { customerId: string; legalName: string } | null;
}

// §10.7 Create loan: borrower, facility, partner & payout, remarks.
export default function CreateLoanDialog({ open, onOpenChange, onCreated, customer: prefill }: CreateLoanDialogProps) {
  const form = useZodForm(schema, DEFAULTS);
  const { control, handleSubmit, watch, setValue, reset, formState } = form;
  const { data: bankPools } = useFetch<BankPool[]>(open ? '/api/v1/bank-pools' : '');
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [vehicles, setVehicles] = useState<ComboOption[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const customerId = watch('customerId');
  const productType = watch('productType');
  const requested = watch('requestedAmount');
  const [payout, bonus, shared] = watch(['bankPayoutPctAmt', 'bonusPayoutAmt', 'sharedPayoutAmt']);

  useEffect(() => {
    if (!open) return;
    reset({ ...DEFAULTS, customerId: prefill?.customerId ?? '' });
    setCustomer(null);
    setServerError(null);
    if (prefill) {
      searchCustomers(prefill.legalName).then((hits) => setCustomer(hits.find((h) => h.value === prefill.customerId)?.customer ?? null)).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.customerId, reset]);

  useEffect(() => {
    setVehicles(null);
    if (!customerId) return;
    let cancelled = false;
    customerVehicles(customerId).then((v) => !cancelled && setVehicles(v)).catch(() => !cancelled && setVehicles([]));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const headroom = customer ? Math.max(0, customer.assignedCeiling - customer.currentUtilization) : null;
  const exceedsHeadroom = productType === 'USED_CV' && headroom != null && requested != null && requested > headroom;
  const totalEarned = (payout ?? 0) + (bonus ?? 0) - (shared ?? 0);

  const poolOptions: ComboOption[] = (bankPools ?? []).map((p) => ({
    value: p.poolId,
    label: `${p.lenderName} — ${p.facilityAccountNumber}`,
    secondary: `${formatINR(p.utilizedAmount, { whole: true })} of ${formatINR(p.sanctionedLimit, { whole: true })} used`,
  }));
  const selectedPool = bankPools?.find((p) => p.poolId === watch('poolId'));

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await apiPost<{ data?: { loanId?: string }; loanId?: string }>('/api/v1/loans', {
        customerId: values.customerId,
        vehicleId: values.vehicleId,
        poolId: values.poolId,
        partnerId: values.partnerId || null,
        lenderAgreementNumber: values.lenderAgreementNumber || null,
        productType: values.productType,
        requestedAmount: values.requestedAmount,
        bankPayoutPctAmt: values.bankPayoutPctAmt,
        bonusPayoutAmt: values.bonusPayoutAmt,
        sharedPayoutAmt: values.sharedPayoutAmt,
        remarks: values.remarks || null,
      });
      notifySuccess('Loan file created');
      onOpenChange(false);
      onCreated(res?.data?.loanId ?? res?.loanId ?? null);
    } catch (err) {
      setServerError(errorMessage(err, "The loan file wasn't created."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create loan"
      description="Sanctioned amount, tenure and rate are captured at sanction."
      size="lg"
      dirty={formState.isDirty && !formState.isSubmitSuccessful}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Creating…">Create loan</Button>
        </>
      }
    >
      <div className="space-y-6">
        <FormSection title="Borrower">
          <FormField
            control={control}
            name="customerId"
            label="Customer"
            required
            hint={customer ? `Headroom ${formatINR(headroom, { whole: true })} of ${formatINR(customer.assignedCeiling, { whole: true })}` : undefined}
            render={(f) => (
              <Combobox
                value={f.value}
                onValueChange={(v, option) => {
                  f.onChange(v);
                  setValue('vehicleId', '');
                  setCustomer((option as (ComboOption & { customer?: CustomerHit }) | null)?.customer ?? null);
                }}
                search={searchCustomers}
                selectedLabel={prefill?.legalName}
                placeholder="Search customers"
                searchPlaceholder="Name, trade name or phone"
              />
            )}
          />
          {customer && (
            <UtilizationMeter used={customer.currentUtilization} ceiling={customer.assignedCeiling} />
          )}
          {customer?.stopSupplyFlag && (
            <Alert tone="danger" title="Stop supply">This customer is on stop supply. New loans may be refused.</Alert>
          )}
          <FormField
            control={control}
            name="vehicleId"
            label="Vehicle"
            required
            render={(f) => (
              <Combobox
                value={f.value}
                onValueChange={(v) => f.onChange(v)}
                options={vehicles ?? []}
                disabled={!customerId || vehicles === null}
                placeholder={!customerId ? 'Choose a customer first' : vehicles === null ? 'Loading vehicles…' : 'Choose a vehicle'}
                searchPlaceholder="Registration number"
                emptyText={() => 'No vehicles'}
              />
            )}
          />
          {customerId && vehicles?.length === 0 && (
            <Alert tone="warning">
              This customer has no vehicles.{' '}
              <Link to={`/customers/${customerId}?tab=vehicles&addVehicle=1`} className="font-medium text-primary underline-offset-4 hover:underline">Add a vehicle</Link> first.
            </Alert>
          )}
        </FormSection>

        <FormSection title="Facility">
          <FormField
            control={control}
            name="poolId"
            label="Bank pool"
            required
            render={(f) => (
              <Combobox value={f.value} onValueChange={(v) => f.onChange(v)} options={poolOptions} placeholder="Choose a lender facility" searchPlaceholder="Lender or account" />
            )}
          />
          {selectedPool && <UtilizationMeter used={selectedPool.utilizedAmount} ceiling={selectedPool.sanctionedLimit} label="Pool utilization" />}
          <FormField
            control={control}
            name="productType"
            label="Product type"
            required
            render={(f) => (
              <Segmented aria-label="Product type" value={f.value} onValueChange={(v) => f.onChange(v as FormValues['productType'])} options={PRODUCT_TYPES} className="w-full sm:w-auto" />
            )}
          />
          <FieldGrid>
            <FormField
              control={control}
              name="requestedAmount"
              label="Requested amount"
              required
              hint={exceedsHeadroom ? undefined : 'Checked against the sub-limit for Used CV.'}
              render={(f) => <CurrencyInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} showWords />}
            />
            <FormField
              control={control}
              name="lenderAgreementNumber"
              label="Lender agreement no"
              optional
              render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} className="id-mono" />}
            />
          </FieldGrid>
          {exceedsHeadroom && (
            <Alert tone="warning">The requested amount is more than the customer's headroom of {formatINR(headroom, { whole: true })}.</Alert>
          )}
        </FormSection>

        <FormSection title="Partner and payout">
          <FormField
            control={control}
            name="partnerId"
            label="Partner"
            optional
            render={(f) => <Combobox value={f.value} onValueChange={(v) => f.onChange(v)} search={searchPartners} placeholder="No partner" clearable />}
          />
          <FieldGrid columns={3}>
            <FormField control={control} name="bankPayoutPctAmt" label="Payout" render={(f) => <CurrencyInput value={f.value ?? null} onValueChange={(v) => f.onChange((v ?? 0) as number)} onBlur={f.onBlur} />} />
            <FormField control={control} name="bonusPayoutAmt" label="Bonus" render={(f) => <CurrencyInput value={f.value ?? null} onValueChange={(v) => f.onChange((v ?? 0) as number)} onBlur={f.onBlur} />} />
            <FormField control={control} name="sharedPayoutAmt" label="Shared" render={(f) => <CurrencyInput value={f.value ?? null} onValueChange={(v) => f.onChange((v ?? 0) as number)} onBlur={f.onBlur} />} />
          </FieldGrid>
          <p className="num flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total earned = payout + bonus − shared</span>
            <span className={totalEarned < 0 ? 'font-semibold text-danger' : 'font-semibold text-foreground'}>{formatINR(totalEarned)}</span>
          </p>
        </FormSection>

        <FormField
          control={control}
          name="remarks"
          label="Remarks"
          optional
          render={(f) => <Textarea value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} maxLength={1000} rows={2} />}
        />
      </div>
    </ResponsiveDialog>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Edit3, FilePlus2, Plus, RotateCw, UserCheck } from 'lucide-react';
import { z } from 'zod';
import { apiPost, apiPut } from '@/api/client';
import { DETAIL_STALE_MS, useFetch } from '@/hooks/useFetch';
import { useTerms } from '@/theme/ThemeProvider';
import ActivityThread, { type ActivityEvent } from '@/components/ActivityThread';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { CodeInput, IntegerInput, RegNoInput, isValidRegNo } from '@/components/inputs';
import { MetricCard, MetricStrip, UtilizationMeter } from '@/components/metrics';
import StatusBadge from '@/components/StatusBadge';
import Badge from '@/components/Badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Card, Empty, Skeleton } from '@/components/ui/feedback';
import { FieldGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { useRecordTitle } from '@/layouts/PageMeta';
import { MetaSep, RecordHeader, StickyActionDock } from '@/layouts/templates';
import { formatDate, formatINR, formatPhone, formatRegNo, humanize } from '@/lib/format';
import CreateLoanDialog from '../loans/CreateLoanDialog';
import type { LoanListItem } from '../loans/loanTypes';

interface Customer {
  customerId: string;
  customerType: string;
  legalName: string;
  tradeName: string | null;
  phoneNumber: string | null;
  cibilScore: number | null;
  cibilTier: string | null;
  riskStatus: string;
  assignedCeiling: number;
  currentUtilization: number;
  availableSubLimit: number;
  pendingRcCount: number;
  maxPendingRcAllowed: number;
  stopSupplyFlag: boolean;
}

interface Vehicle {
  vehicleId: string;
  registrationNumber: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  yearOfMfg: number | null;
  ownershipCount: number;
  ownerCustomerId: string | null;
  currentRtoStatus: string;
}

interface CustomerLead {
  leadId: string;
  applicantName: string;
  leadSource: string;
  leadStatus: string;
  createdAt: string;
  convertedAt: string | null;
  vehicleRegistrationNumber: string | null;
  vehicleAction: string | null;
}

const RTO_STATUSES = [
  { value: 'CLEAN', label: 'Clean' },
  { value: 'HYPOTHECATED', label: 'Hypothecated' },
  { value: 'RC_PENDING', label: 'RC pending' },
  { value: 'BLACKLISTED', label: 'Blacklisted' },
];

const thisYear = new Date().getFullYear();

const vehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Enter the registration number').refine(isValidRegNo, 'Use the Indian format, for example GJ05BX1234'),
  make: z.string().max(60),
  model: z.string().max(60),
  variant: z.string().max(60),
  yearOfMfg: z.number().int().min(1980, 'Check the year').max(thisYear + 1, 'Check the year').nullable(),
  ownershipCount: z.number({ error: 'Enter the ownership count' }).int().min(1).max(20),
  chassisNumber: z.string().max(30),
  engineNumber: z.string().max(30),
  currentRtoStatus: z.string(),
});

function VehicleDialog({ open, onOpenChange, customerId, vehicle, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string;
  vehicle: Vehicle | null;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const defaults = {
    registrationNumber: vehicle?.registrationNumber ?? '', make: vehicle?.make ?? '', model: vehicle?.model ?? '', variant: vehicle?.variant ?? '',
    yearOfMfg: vehicle?.yearOfMfg ?? null, ownershipCount: vehicle?.ownershipCount ?? 1, chassisNumber: vehicle?.chassisNumber ?? '',
    engineNumber: vehicle?.engineNumber ?? '', currentRtoStatus: vehicle?.currentRtoStatus ?? 'CLEAN',
  };
  const form = useZodForm(vehicleSchema, defaults);
  const { control, handleSubmit, reset, formState } = form;
  useEffect(() => {
    if (open) {
      reset(defaults);
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle]);

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    const body = {
      registrationNumber: v.registrationNumber,
      chassisNumber: v.chassisNumber || null,
      engineNumber: v.engineNumber || null,
      make: v.make || null,
      model: v.model || null,
      variant: v.variant || null,
      yearOfMfg: v.yearOfMfg,
    };
    try {
      if (vehicle) {
        await apiPut(`/api/v1/vehicles/${vehicle.vehicleId}`, { ...body, ownershipCount: v.ownershipCount, ownerCustomerId: customerId, currentRtoStatus: v.currentRtoStatus });
        notifySuccess('Vehicle updated');
      } else {
        await apiPost(`/api/v1/customers/${customerId}/vehicles`, body);
        notifySuccess('Vehicle added');
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setServerError(errorMessage(err, "The vehicle wasn't saved."));
    }
  }, focusFirstError);

  const text = (name: 'make' | 'model' | 'variant', label: string) => (
    <FormField control={control} name={name} label={label} optional render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={vehicle ? 'Edit vehicle' : 'Add vehicle'}
      size="lg"
      dirty={formState.isDirty}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Saving…">{vehicle ? 'Save vehicle' : 'Add vehicle'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField control={control} name="registrationNumber" label="Registration no" required render={(f) => <RegNoInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} autoFocus />} />
        <FieldGrid columns={3}>{text('make', 'Make')}{text('model', 'Model')}{text('variant', 'Variant')}</FieldGrid>
        <FieldGrid>
          <FormField control={control} name="yearOfMfg" label="Year of manufacture" optional render={(f) => <IntegerInput value={f.value ?? null} onValueChange={f.onChange} onBlur={f.onBlur} min={1980} max={thisYear + 1} />} />
          {vehicle && (
            <FormField control={control} name="ownershipCount" label="Ownership count" required render={(f) => <IntegerInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} min={1} max={20} />} />
          )}
        </FieldGrid>
        <FieldGrid>
          <FormField control={control} name="chassisNumber" label="Chassis no" optional render={(f) => <CodeInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} />} />
          <FormField control={control} name="engineNumber" label="Engine no" optional render={(f) => <CodeInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} />} />
        </FieldGrid>
        {vehicle && (
          <FormField control={control} name="currentRtoStatus" label="RTO status" required render={(f) => <Select value={f.value} onValueChange={f.onChange} options={RTO_STATUSES} />} />
        )}
      </div>
    </ResponsiveDialog>
  );
}

// §10.6 Customer detail.
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const terms = useTerms();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: customer, error, refetch: refetchCustomer, loading } = useFetch<Customer>(`/api/v1/customers/${id}`, [id], { staleAfter: DETAIL_STALE_MS });
  const vehiclesQ = useFetch<Vehicle[]>(`/api/v1/customers/${id}/vehicles`, [id]);
  const leadsQ = useFetch<CustomerLead[]>(`/api/v1/customers/${id}/leads`, [id]);
  const loansQ = useFetch<LoanListItem[]>(`/api/v1/loans?customerId=${id}&pageSize=100&sortBy=createdAt&sortDir=desc`, [id]);
  const [vehicleDialog, setVehicleDialog] = useState<{ open: boolean; vehicle: Vehicle | null }>({ open: false, vehicle: null });
  const [loanOpen, setLoanOpen] = useState(false);

  useRecordTitle(customer?.legalName);

  // ?addVehicle=1 from the Create loan dialog's "Add a vehicle" link.
  useEffect(() => {
    if (searchParams.get('addVehicle') === '1') {
      setVehicleDialog({ open: true, vehicle: null });
      setSearchParams((p) => { const n = new URLSearchParams(p); n.delete('addVehicle'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (error && !customer) {
    return <Alert tone="danger" title="This customer didn't load" action={<Button variant="outline" size="sm" icon={RotateCw} onClick={refetchCustomer}>Retry</Button>}>{error}</Alert>;
  }
  if (!customer) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const vehicles = vehiclesQ.data ?? [];
  const leads = leadsQ.data ?? [];
  const loans = loansQ.data ?? [];
  const openLoans = loans.filter((l) => !['CLOSED', 'REJECTED', 'WITHDRAWN'].includes(l.loanStatus));
  const openLoanVehicles = new Set(openLoans.map((l) => l.vehicleRegNo));
  const rcAtLimit = customer.pendingRcCount >= customer.maxPendingRcAllowed;

  const vehicleColumns: ColumnDef<Vehicle>[] = [
    { id: 'reg', header: 'Reg no', kind: 'id', mobile: 'title', cell: (v) => <span className="id-mono font-medium">{formatRegNo(v.registrationNumber)}</span> },
    { id: 'mmv', header: 'Make / model', mobile: 'subtitle', cell: (v) => [v.make, v.model, v.variant].filter(Boolean).join(' ') || <Empty /> },
    { id: 'year', header: 'Year', kind: 'number', mobile: 'meta', cell: (v) => v.yearOfMfg ?? <Empty /> },
    { id: 'owners', header: 'Owners', kind: 'number', mobile: 'meta', priority: 2, cell: (v) => v.ownershipCount },
    { id: 'rto', header: 'RTO status', kind: 'status', mobile: 'badge', cell: (v) => <StatusBadge status={v.currentRtoStatus} inTable /> },
    { id: 'loan', header: 'Open loan', mobile: 'meta', cell: (v) => (openLoanVehicles.has(v.registrationNumber) ? <Badge text="Open loan" variant="info" /> : <Empty />) },
  ];

  const loanColumns: ColumnDef<LoanListItem>[] = [
    { id: 'app', header: 'Application #', kind: 'id', mobile: 'title', cell: (l) => <span className="id-mono">{l.applicationNumber}</span> },
    { id: 'veh', header: 'Vehicle', kind: 'id', mobile: 'subtitle', cell: (l) => formatRegNo(l.vehicleRegNo) },
    { id: 'lender', header: 'Lender', priority: 2, mobile: 'hidden', cell: (l) => l.lenderName },
    { id: 'sanctioned', header: 'Sanctioned', kind: 'currency', mobile: 'meta', cell: (l) => (l.sanctionedAmount == null ? <Empty /> : formatINR(l.sanctionedAmount, { whole: true })) },
    { id: 'bal', header: terms.brokerLedgerName, kind: 'currency', mobile: 'meta', cell: (l) => formatINR(l.netDisbursedAmount, { whole: true }) },
    { id: 'status', header: 'Status', kind: 'status', mobile: 'badge', cell: (l) => <StatusBadge status={l.loanStatus} domain="loan" inTable /> },
  ];

  const leadColumns: ColumnDef<CustomerLead>[] = [
    { id: 'name', header: 'Applicant', mobile: 'title', cell: (l) => l.applicantName },
    { id: 'source', header: 'Source', mobile: 'subtitle', cell: (l) => humanize(l.leadSource) },
    { id: 'vehicle', header: 'Vehicle', kind: 'id', priority: 2, mobile: 'meta', cell: (l) => (l.vehicleRegistrationNumber ? formatRegNo(l.vehicleRegistrationNumber) : <Empty />) },
    { id: 'status', header: 'Status', kind: 'status', mobile: 'badge', cell: (l) => <StatusBadge status={l.leadStatus} domain="lead" inTable /> },
    { id: 'created', header: 'Created', kind: 'date', mobile: 'meta', cell: (l) => formatDate(l.createdAt) },
    { id: 'converted', header: 'Converted', kind: 'date', priority: 2, mobile: 'meta', cell: (l) => formatDate(l.convertedAt) },
  ];

  const events: ActivityEvent[] = [
    ...leads.filter((l) => l.convertedAt).map((l) => ({ id: `lead-${l.leadId}`, at: l.convertedAt!, icon: UserCheck, text: `Lead from ${l.applicantName} converted` })),
  ];

  const createLoan = (
    <Button icon={FilePlus2} onClick={() => setLoanOpen(true)}>Create loan</Button>
  );

  return (
    <>
      <RecordHeader
        title={customer.legalName}
        badges={
          <>
            <Badge text={humanize(customer.customerType)} />
            <StatusBadge status={customer.riskStatus} />
            {customer.stopSupplyFlag && <StatusBadge status="STOP_SUPPLY" />}
          </>
        }
        meta={
          <>
            {customer.tradeName && <><span>{customer.tradeName}</span><MetaSep /></>}
            {customer.phoneNumber ? <a href={`tel:${customer.phoneNumber}`} className="num text-foreground hover:underline">{formatPhone(customer.phoneNumber)}</a> : <span>No phone</span>}
          </>
        }
        actions={
          <>
            <Tooltip content="Refresh">
              <Button variant="ghost" size="icon" aria-label="Refresh customer" loading={loading} onClick={() => { void refetchCustomer(); void vehiclesQ.refetch(); void loansQ.refetch(); }}><RotateCw /></Button>
            </Tooltip>
            {createLoan}
          </>
        }
      />
      {customer.stopSupplyFlag && (
        <Alert tone="danger" title="Stop supply" className="mb-4">This customer is on stop supply. New loans may be refused until it's lifted.</Alert>
      )}

      <div className="mb-5">
        <MetricStrip columns={4}>
          <div className="rounded-lg border bg-surface p-card shadow-xs dark:shadow-none">
            <UtilizationMeter used={customer.currentUtilization} ceiling={customer.assignedCeiling} />
            <p className="num mt-2 text-caption text-success">Headroom {formatINR(customer.availableSubLimit, { whole: true })}</p>
          </div>
          <MetricCard
            label="Pending RCs"
            value={`${customer.pendingRcCount} of ${customer.maxPendingRcAllowed}`}
            context={rcAtLimit ? 'At the pending RC limit' : undefined}
            contextTone={rcAtLimit ? 'warning' : undefined}
          />
          <MetricCard
            label="CIBIL"
            value={customer.cibilScore ?? '—'}
            context={customer.cibilTier ? <StatusBadge status={customer.cibilTier} /> : 'Not checked'}
          />
          <MetricCard
            label="Open loans"
            value={openLoans.length}
            context={openLoans.length ? `${formatINR(openLoans.reduce((s, l) => s + (l.sanctionedAmount ?? l.requestedAmount), 0), { whole: true })} total` : undefined}
          />
        </MetricStrip>
      </div>

      <Tabs
        tabs={[
          {
            value: 'vehicles',
            label: 'Vehicles',
            count: vehicles.length,
            content: (
              <DataTable
                label="Vehicles"
                columns={vehicleColumns}
                rows={vehiclesQ.data}
                getRowId={(v) => v.vehicleId}
                loading={vehiclesQ.loading}
                error={vehiclesQ.error}
                onRetry={vehiclesQ.refetch}
                rowActions={(v) => [{ label: 'Edit vehicle', icon: Edit3, onSelect: () => setVehicleDialog({ open: true, vehicle: v }) }]}
                empty={{ title: 'No vehicles yet', description: 'Add the vehicles this customer owns before creating loans.', action: <Button icon={Plus} onClick={() => setVehicleDialog({ open: true, vehicle: null })}>Add vehicle</Button> }}
              />
            ),
          },
          {
            value: 'loans',
            label: 'Loans',
            count: loansQ.data ? loans.length : null,
            content: (
              <DataTable
                label="Loans"
                columns={loanColumns}
                rows={loansQ.data}
                getRowId={(l) => l.loanId}
                loading={loansQ.loading}
                error={loansQ.error}
                onRetry={loansQ.refetch}
                rowHref={(l) => `/loans/${l.loanId}`}
                empty={{ title: 'No loans yet', action: createLoan }}
              />
            ),
          },
          {
            value: 'leads',
            label: 'Leads',
            count: leads.length,
            content: (
              <DataTable
                label="Leads"
                columns={leadColumns}
                rows={leadsQ.data}
                getRowId={(l) => l.leadId}
                loading={leadsQ.loading}
                error={leadsQ.error}
                onRetry={leadsQ.refetch}
                rowHref={(l) => `/leads/${l.leadId}`}
                empty={{ title: 'No leads', description: 'Leads converted to this customer show up here.' }}
              />
            ),
          },
          { value: 'activity', label: 'Activity', content: <Card><ActivityThread events={events} /></Card> },
        ]}
        toolbar={<Button variant="outline" size="sm" icon={Plus} onClick={() => setVehicleDialog({ open: true, vehicle: null })} className="hidden md:inline-flex">Add vehicle</Button>}
      />

      <StickyActionDock>
        {createLoan}
        <Button variant="outline" icon={Plus} onClick={() => setVehicleDialog({ open: true, vehicle: null })}>Add vehicle</Button>
      </StickyActionDock>

      <VehicleDialog
        open={vehicleDialog.open}
        onOpenChange={(o) => setVehicleDialog((d) => ({ ...d, open: o }))}
        customerId={customer.customerId}
        vehicle={vehicleDialog.vehicle}
        onSaved={() => void vehiclesQ.refetch()}
      />
      <CreateLoanDialog
        open={loanOpen}
        onOpenChange={setLoanOpen}
        customer={{ customerId: customer.customerId, legalName: customer.legalName }}
        onCreated={() => { void loansQ.refetch(); void refetchCustomer(); }}
      />
    </>
  );
}

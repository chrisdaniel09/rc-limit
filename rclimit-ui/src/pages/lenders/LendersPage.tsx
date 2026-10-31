import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import { apiPost } from '@/api/client';
import { useClientFilter } from '@/hooks/useClientFilter';
import { useFetch } from '@/hooks/useFetch';
import DataTable, { type ColumnDef } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { CodeInput, IntegerInput, PercentInput } from '@/components/inputs';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { FieldGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { PageHeader } from '@/layouts/templates';
import { formatPercent } from '@/lib/format';

interface Lender {
  lenderId: string;
  name: string;
  code: string;
  baseInterestRate: number;
  defaultTenureLimitDays: number;
  status: string;
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the lender name').max(200),
  code: z.string().min(2, 'Enter a code').max(40),
  baseInterestRate: z.number({ error: 'Enter the base rate' }).min(0).max(60),
  defaultTenureLimitDays: z.number({ error: 'Enter the tenure' }).int().min(1).max(3650),
});

export default function LendersPage() {
  const { data, loading, error, refetch } = useFetch<Lender[]>('/api/v1/lenders');
  const list = useClientFilter(data, (l) => [l.name, l.code]);
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useZodForm(schema, { name: '', code: '', baseInterestRate: null as unknown as number, defaultTenureLimitDays: 45 });
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
      await apiPost('/api/v1/lenders', v);
      notifySuccess('Lender added');
      setOpen(false);
      void refetch();
    } catch (err) {
      setServerError(errorMessage(err, "The lender wasn't added."));
    }
  }, focusFirstError);

  const columns: ColumnDef<Lender>[] = [
    { id: 'name', header: 'Name', mobile: 'title', cell: (l) => l.name },
    { id: 'code', header: 'Code', kind: 'id', mobile: 'subtitle', cell: (l) => l.code },
    { id: 'rate', header: 'Base rate', kind: 'number', mobile: 'meta', cell: (l) => formatPercent(l.baseInterestRate) },
    { id: 'tenure', header: 'Default tenure', kind: 'number', mobile: 'meta', cell: (l) => `${l.defaultTenureLimitDays} days` },
    { id: 'status', header: 'Status', kind: 'status', mobile: 'badge', cell: (l) => <StatusBadge status={l.status} inTable /> },
  ];

  return (
    <>
      <PageHeader title="Lenders" count={data?.length} actions={<Button icon={Plus} data-new-record onClick={() => setOpen(true)}>Add lender</Button>} />
      <FilterBar searchValue={list.search} onSearchChange={list.setSearch} searchPlaceholder="Search lenders…" />
      <DataTable
        label="Lenders"
        columns={columns}
        rows={list.filtered}
        getRowId={(l) => l.lenderId}
        loading={loading}
        error={error}
        onRetry={refetch}
        isFiltered={list.isFiltered}
        onClearFilters={list.clear}
        empty={{ title: 'No lenders yet', description: 'Add the banks and NBFCs you place loans with.', action: <Button icon={Plus} onClick={() => setOpen(true)}>Add lender</Button> }}
      />
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        variant="sheet"
        title="Add lender"
        dirty={formState.isDirty}
        error={serverError}
        onSubmit={() => void submit()}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={formState.isSubmitting} loadingText="Adding…">Add lender</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField control={control} name="name" label="Name" required render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} autoFocus />} />
          <FormField control={control} name="code" label="Code" required render={(f) => <CodeInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} placeholder="CHOLA_CV" />} />
          <FieldGrid>
            <FormField control={control} name="baseInterestRate" label="Base interest rate" required render={(f) => <PercentInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} />} />
            <FormField control={control} name="defaultTenureLimitDays" label="Default tenure (days)" required render={(f) => <IntegerInput value={f.value ?? null} onValueChange={(v) => f.onChange(v as number)} onBlur={f.onBlur} min={1} max={3650} />} />
          </FieldGrid>
        </div>
      </ResponsiveDialog>
    </>
  );
}

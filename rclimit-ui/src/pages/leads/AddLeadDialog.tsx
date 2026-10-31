import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiPost } from '@/api/client';
import { FormField, focusFirstError, useZodForm } from '@/components/form';
import { PhoneInput } from '@/components/inputs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/choice';
import { Combobox } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { FieldGrid, FormSection } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, notifySuccess } from '@/components/ui/toast';
import { INDIAN_MOBILE_MESSAGE, isValidIndianMobile, toPhoneNumber } from '@/utils/phone';
import ProductFieldInput, { validateProductField } from './ProductFieldInput';
import { toProductDetails, type ProductType } from './productTypes';
import { LEAD_SOURCES, type StaffUser } from './leadShared';

const schema = z.object({
  productTypeCode: z.string().min(1, 'Choose the financial requirement'),
  applicantName: z.string().trim().min(2, "Enter the applicant's name").max(200),
  leadSource: z.string().min(1),
  referredByUserId: z.string(),
  whatsappPhoneNumber: z.string().refine(isValidIndianMobile, INDIAN_MOBILE_MESSAGE),
  contactPhone: z.string().refine((v) => v === '' || isValidIndianMobile(v), INDIAN_MOBILE_MESSAGE),
  notes: z.string().max(2000),
});

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTypes: ProductType[];
  users: StaffUser[];
  onCreated: (leadId: string | null) => void;
}

// §10.3 Add lead: the financial requirement first, its fields below it.
export default function AddLeadDialog({ open, onOpenChange, productTypes, users, onCreated }: AddLeadDialogProps) {
  const active = productTypes.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const form = useZodForm(schema, { productTypeCode: '', applicantName: '', leadSource: 'WALK_IN', referredByUserId: '', whatsappPhoneNumber: '', contactPhone: '', notes: '' });
  const { control, handleSubmit, reset, watch, setValue, formState } = form;
  const [details, setDetails] = useState<Record<string, string>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string | undefined>>({});
  const [sameAsWhatsapp, setSameAsWhatsapp] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    reset({ productTypeCode: active[0]?.code ?? '', applicantName: '', leadSource: 'WALK_IN', referredByUserId: '', whatsappPhoneNumber: '', contactPhone: '', notes: '' });
    setDetails({});
    setDetailErrors({});
    setSameAsWhatsapp(false);
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const productCode = watch('productTypeCode');
  const whatsapp = watch('whatsappPhoneNumber');
  const product = active.find((p) => p.code === productCode);

  useEffect(() => {
    if (sameAsWhatsapp) setValue('contactPhone', whatsapp, { shouldValidate: true });
  }, [sameAsWhatsapp, whatsapp, setValue]);

  const submit = handleSubmit(async (v) => {
    const fields = product?.fieldSchema ?? [];
    const errors = Object.fromEntries(fields.map((f) => [f.key, validateProductField(f, details[f.key] ?? '')]));
    setDetailErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      focusFirstError();
      return;
    }
    setServerError(null);
    try {
      const res = await apiPost<{ data?: { leadId?: string }; leadId?: string }>('/api/v1/leads', {
        leadSource: v.leadSource,
        referredByUserId: v.referredByUserId || null,
        applicantName: v.applicantName,
        whatsappPhoneNumber: toPhoneNumber(v.whatsappPhoneNumber),
        contactPhone: toPhoneNumber(v.contactPhone),
        productTypeCode: v.productTypeCode,
        productDetails: toProductDetails(fields, details),
        notes: v.notes || null,
      });
      notifySuccess('Lead added');
      onOpenChange(false);
      onCreated(res?.data?.leadId ?? res?.leadId ?? null);
    } catch (err) {
      setServerError(errorMessage(err, "The lead wasn't added."));
    }
  }, focusFirstError);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add lead"
      size="lg"
      dirty={formState.isDirty || Object.keys(details).length > 0}
      onSubmit={() => void submit()}
      error={serverError}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={formState.isSubmitting} loadingText="Adding…">Add lead</Button>
        </>
      }
    >
      <div className="space-y-6">
        <FormField
          control={control}
          name="productTypeCode"
          label="Financial requirement"
          required
          render={(f) => (
            <Select
              value={f.value}
              onValueChange={(v) => {
                f.onChange(v);
                setDetails({});
                setDetailErrors({});
              }}
              options={active.map((p) => ({ value: p.code, label: p.label }))}
            />
          )}
        />
        {product && product.fieldSchema.length > 0 && (
          <FormSection title="Requirement details">
            <FieldGrid>
              {product.fieldSchema.map((field) => (
                <ProductFieldInput
                  key={field.key}
                  field={field}
                  value={details[field.key] ?? ''}
                  error={detailErrors[field.key]}
                  onChange={(v) => {
                    setDetails((d) => ({ ...d, [field.key]: v }));
                    if (detailErrors[field.key]) setDetailErrors((e) => ({ ...e, [field.key]: validateProductField(field, v) }));
                  }}
                />
              ))}
            </FieldGrid>
          </FormSection>
        )}
        <FormSection title="Applicant">
          <FormField control={control} name="applicantName" label="Applicant name" required render={(f) => <Input value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} />} />
          <FieldGrid>
            <FormField control={control} name="leadSource" label="Source" required render={(f) => <Select value={f.value} onValueChange={f.onChange} options={LEAD_SOURCES} />} />
            <FormField
              control={control}
              name="referredByUserId"
              label="Brought in by"
              optional
              render={(f) => (
                <Combobox
                  value={f.value}
                  onValueChange={(v) => f.onChange(v)}
                  options={users.map((u) => ({ value: u.userId, label: u.fullName || u.email || u.userId, secondary: u.email ?? undefined }))}
                  placeholder="Choose a team member"
                  clearable
                />
              )}
            />
          </FieldGrid>
          <FieldGrid>
            <FormField control={control} name="whatsappPhoneNumber" label="WhatsApp phone" required render={(f) => <PhoneInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} />} />
            <FormField control={control} name="contactPhone" label="Contact phone" optional render={(f) => <PhoneInput value={f.value} onValueChange={f.onChange} onBlur={f.onBlur} disabled={sameAsWhatsapp} />} />
          </FieldGrid>
          <Checkbox label="Contact phone is the same as WhatsApp" checked={sameAsWhatsapp} onCheckedChange={setSameAsWhatsapp} />
        </FormSection>
        <FormField
          control={control}
          name="notes"
          label="Notes"
          optional
          render={(f) => <Textarea value={f.value} onChange={(e) => f.onChange(e.target.value)} onBlur={f.onBlur} placeholder="Anything useful about this lead" maxLength={2000} />}
        />
      </div>
    </ResponsiveDialog>
  );
}

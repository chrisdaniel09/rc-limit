import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CodeInput, DateInput, RegNoInput } from '@/components/inputs';
import type { ProductField } from './productTypes';

interface ProductFieldInputProps {
  field: ProductField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

// Renders one field from a product type's schema. The form has no knowledge of any particular product.
export default function ProductFieldInput({ field, value, onChange, disabled, error }: ProductFieldInputProps) {
  const validation = field.validation;
  const control = (() => {
    if (field.type === 'select') {
      return (
        <Select
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          options={(validation?.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      );
    }
    if (field.type === 'number') {
      return (
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
          disabled={disabled}
          className="num"
        />
      );
    }
    if (field.type === 'date') return <DateInput value={value} onValueChange={onChange} disabled={disabled} />;
    if (field.role === 'vehicle_registration') return <RegNoInput value={value} onValueChange={onChange} disabled={disabled} />;
    if (field.role === 'vehicle_chassis' || field.role === 'vehicle_engine') return <CodeInput value={value} onValueChange={onChange} disabled={disabled} />;
    return <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={validation?.pattern ? 'As per the expected format' : undefined} />;
  })();

  const hint = field.type === 'number' && (validation?.min != null || validation?.max != null)
    ? [validation?.min != null && `Min ${validation.min}`, validation?.max != null && `max ${validation.max}`].filter(Boolean).join(', ')
    : undefined;

  return (
    <Field label={field.label} required={field.required} error={error} hint={hint}>
      {control}
    </Field>
  );
}

// Client-side check of one product field against its schema, so errors show at the field.
export function validateProductField(field: ProductField, raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return field.required ? `Enter ${field.label.toLowerCase()}` : undefined;
  const v = field.validation;
  if (field.type === 'number') {
    const n = Number(value);
    if (Number.isNaN(n)) return 'Enter a number';
    if (v?.min != null && n < v.min) return `At least ${v.min}`;
    if (v?.max != null && n > v.max) return `At most ${v.max}`;
  }
  if (v?.pattern) {
    try {
      if (!new RegExp(v.pattern).test(value)) return "This doesn't match the expected format";
    } catch {
      // A bad pattern in the schema shouldn't block entry; the server validates too.
    }
  }
  return undefined;
}

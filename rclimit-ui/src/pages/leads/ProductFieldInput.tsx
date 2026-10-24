import FormField from '../../components/FormField';
import type { ProductField } from './productTypes';

interface ProductFieldInputProps {
  field: ProductField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Renders one field from a product type's schema. The form has no knowledge of any particular product.
export default function ProductFieldInput({ field, value, onChange, disabled }: ProductFieldInputProps) {
  const validation = field.validation;

  if (field.type === 'select') {
    const options = (validation?.options ?? []).map((option) => ({ value: option, label: option }));
    return (
      <FormField label={field.label} value={value} onChange={onChange} options={options} required={field.required} disabled={disabled} />
    );
  }

  if (field.type === 'number') {
    return (
      <FormField
        label={field.label}
        type="number"
        value={value}
        onChange={onChange}
        required={field.required}
        disabled={disabled}
      />
    );
  }

  if (field.type === 'date') {
    return <FormField label={field.label} type="date" value={value} onChange={onChange} required={field.required} disabled={disabled} />;
  }

  return (
    <FormField
      label={field.label}
      value={value}
      onChange={onChange}
      required={field.required}
      disabled={disabled}
      placeholder={validation?.pattern ? 'As per the expected format' : undefined}
    />
  );
}

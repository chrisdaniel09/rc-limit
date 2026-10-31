import type { ReactNode } from 'react';
import { Controller, useForm, type Control, type DefaultValues, type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Field } from '@/components/ui/field';

// §8.2: React Hook Form + Zod. Validation runs on blur and on submit, not on every keystroke.

export function useZodForm<S extends z.ZodType<FieldValues, FieldValues>>(schema: S, defaultValues: DefaultValues<z.input<S>>) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema as never) as never,
    defaultValues,
    mode: 'onTouched',
  }) as UseFormReturn<z.input<S>, unknown, z.output<S>>;
}

interface FormFieldProps<T extends FieldValues, N extends FieldPath<T>> {
  control: Control<T, unknown, FieldValues>;
  name: N;
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  render: (field: { value: T[N]; onChange: (value: T[N]) => void; onBlur: () => void; ref: (el: unknown) => void; name: N }) => ReactNode;
}

// A labelled control bound to the form; shows the field's error in place of the hint.
export function FormField<T extends FieldValues, N extends FieldPath<T>>({ control, name, label, hint, required, optional, className, render }: FormFieldProps<T, N>) {
  return (
    <Controller
      control={control as Control<T>}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={fieldState.error?.message} required={required} optional={optional} className={className}>
          {render({ value: field.value, onChange: field.onChange, onBlur: field.onBlur, ref: field.ref, name })}
        </Field>
      )}
    />
  );
}

// Focus the first invalid field after a failed submit (§8.11).
export function focusFirstError() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"], form [aria-invalid="true"]')?.focus());
}

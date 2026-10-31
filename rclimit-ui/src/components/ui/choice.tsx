import { forwardRef, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive, RadioGroup, Switch as SwitchPrimitive, ToggleGroup } from 'radix-ui';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

// §8.5 Checkbox, Switch, radio cards; §8.4 segmented control.

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

export function Checkbox({ checked, onCheckedChange, label, description, disabled, id, className, ...aria }: CheckboxProps) {
  const box = (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      className="peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-surface shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground pointer-coarse:size-5"
      {...aria}
    >
      <CheckboxPrimitive.Indicator>
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <label className={cn('flex cursor-pointer items-start gap-2.5 text-sm has-[:disabled]:cursor-not-allowed pointer-coarse:min-h-12 pointer-coarse:items-center', className)}>
      <span className="mt-0.5 pointer-coarse:mt-0">{box}</span>
      <span>
        <span className="text-foreground">{label}</span>
        {description && <span className="block text-caption text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, disabled, className, ...aria }: SwitchProps) {
  const control = (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent bg-input transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary"
      {...aria}
    >
      <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-surface shadow-sm transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
  if (!label) return control;
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-foreground pointer-coarse:min-h-12', className)}>
      {control}
      {label}
    </label>
  );
}

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
}

interface SegmentedProps<V extends string> {
  value: V;
  onValueChange: (value: V) => void;
  options: SegmentOption<V>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

export function Segmented<V extends string>({ value, onValueChange, options, size = 'md', className, disabled, ...aria }: SegmentedProps<V>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as V)}
      disabled={disabled}
      className={cn('inline-flex rounded-md border border-input bg-muted p-0.5', className)}
      {...aria}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[calc(var(--radius)-3px)] px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-xs pointer-coarse:min-h-11',
            size === 'sm' ? 'h-6 text-xs' : 'h-[calc(var(--control-h)-6px)]',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export interface RadioCardOption<V extends string> {
  value: V;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface RadioCardsProps<V extends string> {
  value: V | '';
  onValueChange: (value: V) => void;
  options: RadioCardOption<V>[];
  'aria-label': string;
  columns?: 1 | 2 | 3;
}

export const RadioCards = forwardRef(function RadioCards<V extends string>(
  { value, onValueChange, options, columns = 2, ...aria }: RadioCardsProps<V>,
  ref: React.Ref<HTMLDivElement>,
) {
  return (
    <RadioGroup.Root
      ref={ref}
      value={value}
      onValueChange={(v) => onValueChange(v as V)}
      className={cn('grid grid-cols-1 gap-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}
      {...aria}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="group flex items-start gap-3 rounded-lg border bg-surface p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle"
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-surface group-data-[state=checked]:border-primary">
            <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">{o.icon}{o.title}</span>
            {o.description && <span className="mt-0.5 block text-caption text-muted-foreground">{o.description}</span>}
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}) as <V extends string>(props: RadioCardsProps<V> & { ref?: React.Ref<HTMLDivElement> }) => React.ReactElement;

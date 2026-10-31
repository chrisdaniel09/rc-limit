import { forwardRef, type ReactNode } from 'react';
import { Select as SelectPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClass } from './input';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  // Adds a first item that clears the value ("Any status").
  clearLabel?: string;
}

const CLEAR = '__clear__';

// §8.4: Radix Select for short, fixed lists.
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, onValueChange, options, placeholder = 'Select…', disabled, className, clearLabel, ...aria },
  ref,
) {
  return (
    <SelectPrimitive.Root
      value={value === '' ? undefined : value}
      onValueChange={(v) => onValueChange(v === CLEAR ? '' : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(controlClass, 'flex h-control items-center justify-between gap-2 text-left data-[placeholder]:text-muted-foreground', className)}
        {...aria}
      >
        <span className="truncate"><SelectPrimitive.Value placeholder={placeholder} /></span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-tooltip max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-surface-raised text-foreground shadow-md animate-fade-in"
        >
          <SelectPrimitive.Viewport className="p-1">
            {clearLabel && <SelectItem value={CLEAR}>{clearLabel}</SelectItem>}
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} description={o.description}>{o.label}</SelectItem>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});

function SelectItem({ value, children, description }: { value: string; children: ReactNode; description?: string }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-default select-none items-start gap-2 rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted pointer-coarse:py-3"
    >
      <span className="absolute left-2 top-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator><Check className="size-3.5" /></SelectPrimitive.ItemIndicator>
      </span>
      <div>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
    </SelectPrimitive.Item>
  );
}

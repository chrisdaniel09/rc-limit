import { forwardRef, useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const controlClass =
  'block w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-xs transition-colors duration-[120ms] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-danger aria-invalid:focus-visible:outline-danger/40 read-only:bg-muted/50';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  // Adornments sit inside the control's border (₹ prefix, % suffix, +91).
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, prefix, suffix, ...props }, ref) {
  const input = (
    <input
      ref={ref}
      className={cn(controlClass, 'h-control', prefix != null && 'pl-8', suffix != null && 'pr-8', className)}
      {...props}
    />
  );
  if (prefix == null && suffix == null) return input;
  return (
    <div className="relative">
      {prefix != null && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-center text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      {input}
      {suffix != null && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-center text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxRows?: number;
}

// §8.3: grows with its content up to maxRows; shows a counter from 80% of maxLength.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, maxRows = 8, rows = 3, maxLength, value, ...props },
  forwardedRef,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const max = lineHeight * maxRows + 16;
    el.style.height = `${Math.min(el.scrollHeight + 2, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, [value, maxRows]);

  const length = typeof value === 'string' ? value.length : 0;
  const showCounter = maxLength != null && length >= maxLength * 0.8;

  return (
    <div className="relative">
      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof forwardedRef === 'function') forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
        rows={rows}
        maxLength={maxLength}
        value={value}
        className={cn(controlClass, 'resize-none py-2 leading-5', className)}
        {...props}
      />
      {showCounter && (
        <span className={cn('num mt-1 block text-right text-caption', length >= maxLength ? 'text-danger' : 'text-muted-foreground')}>
          {length} / {maxLength}
        </span>
      )}
    </div>
  );
});

import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatINR } from '@/lib/format';
import { amountInWords } from '@/lib/numberWords';
import { cn } from '@/lib/cn';
import { COUNTRY_CODE, INDIAN_MOBILE_PATTERN } from '@/utils/phone';

// §8.3 specialised inputs. Each takes and emits a typed value; the text shown while typing is formatted.

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'prefix' | 'max' | 'min'>;

const groupIndian = (digits: string) => {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
};

function formatTyped(raw: string): string {
  const [intPart, decPart] = raw.split('.');
  const int = groupIndian(intPart.replace(/^0+(?=\d)/, ''));
  return decPart !== undefined ? `${int || '0'}.${decPart}` : int;
}

function cleanAmount(text: string, decimals: number): string {
  let cleaned = text.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot >= 0) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    if (decimals === 0) cleaned = cleaned.slice(0, firstDot);
    else cleaned = cleaned.slice(0, firstDot + 1 + decimals);
  }
  return cleaned;
}

const toText = (n: number | null) => (n == null ? '' : formatTyped(String(n)));

interface CurrencyInputProps extends BaseProps {
  value: number | null;
  onValueChange: (value: number | null) => void;
  // Shows "Exceeds available balance of ₹…" when the value is larger.
  max?: number;
  maxLabel?: string;
  showWords?: boolean;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, max, maxLabel = 'available balance', showWords, className, ...props },
  ref,
) {
  const [text, setText] = useState(() => toText(value));

  // Follow outside changes (form reset, prefill) without fighting the user's typing.
  useEffect(() => {
    const parsed = text === '' ? null : Number(text.replace(/,/g, ''));
    if (parsed !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const exceeds = max != null && value != null && value > max;
  const words = showWords && value ? amountInWords(value) : '';

  return (
    <div>
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        prefix="₹"
        value={text}
        onChange={(e) => {
          const raw = cleanAmount(e.target.value, 2);
          setText(formatTyped(raw));
          onValueChange(raw === '' || raw === '.' ? null : Number(raw));
        }}
        onWheel={(e) => e.currentTarget.blur()}
        {...props}
        className={cn('num', className)}
        aria-invalid={exceeds || props['aria-invalid'] ? true : undefined}
      />
      {exceeds && <p className="mt-1 text-caption text-danger">Exceeds {maxLabel} of {formatINR(max)}</p>}
      {!exceeds && words && <p className="mt-1 text-caption text-muted-foreground">{words}</p>}
    </div>
  );
});

interface NumberProps extends BaseProps {
  value: number | null;
  onValueChange: (value: number | null) => void;
}

export const PercentInput = forwardRef<HTMLInputElement, NumberProps>(function PercentInput({ value, onValueChange, className, ...props }, ref) {
  const [text, setText] = useState(() => (value == null ? '' : String(value)));
  useEffect(() => {
    const parsed = text === '' ? null : Number(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      suffix="%"
      value={text}
      onChange={(e) => {
        const raw = cleanAmount(e.target.value, 2);
        setText(raw);
        onValueChange(raw === '' || raw === '.' ? null : Number(raw));
      }}
      className={cn('num', className)}
      {...props}
    />
  );
});

interface IntegerInputProps extends NumberProps {
  min?: number;
  max?: number;
  steppers?: boolean;
}

export const IntegerInput = forwardRef<HTMLInputElement, IntegerInputProps>(function IntegerInput(
  { value, onValueChange, min, max, steppers = true, className, disabled, ...props },
  ref,
) {
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const step = (delta: number) => onValueChange(clamp((value ?? min ?? 0) + delta));
  const input = (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value == null ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onValueChange(digits === '' ? null : Number(digits));
      }}
      onBlur={() => value != null && onValueChange(clamp(value))}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
      }}
      className={cn('num', steppers && 'pointer-fine:pr-16', className)}
      {...props}
    />
  );
  if (!steppers) return input;
  return (
    <div className="relative">
      {input}
      <div className="absolute inset-y-0 right-1 hidden items-center gap-0.5 pointer-fine:flex">
        <button type="button" tabIndex={-1} disabled={disabled || (min != null && (value ?? min) <= min)} aria-label="Decrease"
          onClick={() => step(-1)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40">
          <Minus className="size-3.5" />
        </button>
        <button type="button" tabIndex={-1} disabled={disabled || (max != null && (value ?? 0) >= max)} aria-label="Increase"
          onClick={() => step(1)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
});

interface TextValueProps extends BaseProps {
  value: string;
  onValueChange: (value: string) => void;
}

// 10-digit national number with a fixed +91 prefix; displays as 98765 43210.
export const PhoneInput = forwardRef<HTMLInputElement, TextValueProps>(function PhoneInput({ value, onValueChange, className, ...props }, ref) {
  const display = value.length > 5 ? `${value.slice(0, 5)} ${value.slice(5)}` : value;
  return (
    <div className="flex">
      <span className="inline-flex select-none items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
        {COUNTRY_CODE}
      </span>
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={display}
        onChange={(e) => onValueChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder="98765 43210"
        data-pattern={INDIAN_MOBILE_PATTERN}
        className={cn('num rounded-l-none', className)}
        {...props}
      />
    </div>
  );
});

const REG_NO = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;
export const isValidRegNo = (v: string) => REG_NO.test(v);

// Uppercases and strips spaces; stored without spaces.
export const RegNoInput = forwardRef<HTMLInputElement, TextValueProps>(function RegNoInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onValueChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
      placeholder="GJ05BX1234"
      className={cn('id-mono uppercase', className)}
      {...props}
    />
  );
});

// Uppercase identifier input (chassis, engine, codes).
export const CodeInput = forwardRef<HTMLInputElement, TextValueProps>(function CodeInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      autoCapitalize="characters"
      spellCheck={false}
      value={value}
      onChange={(e) => onValueChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
      className={cn('id-mono uppercase', className)}
      {...props}
    />
  );
});

// Native date input on every width: typed entry, the OS picker on mobile, and no calendar dependency.
export const DateInput = forwardRef<HTMLInputElement, TextValueProps & { min?: string; max?: string }>(function DateInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="date"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn('num', className)}
      {...props}
    />
  );
});

// Today in yyyy-mm-dd for date inputs (local time).
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

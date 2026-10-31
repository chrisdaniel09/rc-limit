// All display formatting (docs/ui_ux_specification.md §5). Pages must not build Intl formatters themselves.

const LOCALE = 'en-IN';
const TIME_ZONE = 'Asia/Kolkata';
const MINUS = '−';

export const EMPTY = '—';

const inrFormatters = {
  paise: new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  whole: new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
};

type Amount = number | null | undefined;

const isMissing = (n: Amount): n is null | undefined => n == null || Number.isNaN(n);

// ₹15,00,000.00, or ₹15,00,000 with { whole: true }. Negative values use a real minus: −₹1,200.00.
export function formatINR(n: Amount, options: { whole?: boolean } = {}): string {
  if (isMissing(n)) return EMPTY;
  const formatter = options.whole ? inrFormatters.whole : inrFormatters.paise;
  const text = formatter.format(Math.abs(n));
  return n < 0 ? `${MINUS}${text}` : text;
}

// List columns show whole rupees unless any row has paise; then every row shows 2 decimals so the column aligns.
export function columnIsWhole(values: Amount[]): boolean {
  return values.every((v) => isMissing(v) || Number.isInteger(v));
}

// ₹85 K, ₹15 L, ₹2.4 Cr: metric cards and charts only. Show formatINR in a tooltip beside it.
export function formatINRCompact(n: Amount): string {
  if (isMissing(n)) return EMPTY;
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  const scaled = (value: number, unit: string) => `${sign}₹${trimDecimal(value)} ${unit}`;
  if (abs >= 1e7) return scaled(abs / 1e7, 'Cr');
  if (abs >= 1e5) return scaled(abs / 1e5, 'L');
  if (abs >= 1e3) return scaled(abs / 1e3, 'K');
  return `${sign}${inrFormatters.whole.format(abs)}`;
}

function trimDecimal(value: number): string {
  return value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();
}

// + ₹50,000.00 / − ₹1,200.00: single-column ledger amounts on mobile.
export function formatSignedINR(n: Amount, direction: 'CREDIT' | 'DEBIT'): string {
  if (isMissing(n)) return EMPTY;
  return `${direction === 'CREDIT' ? '+' : MINUS} ${inrFormatters.paise.format(Math.abs(n))}`;
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE,
});

type DateInput = string | number | Date | null | undefined;

function toDate(d: DateInput): Date | null {
  if (d == null || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 30 Oct 2026
export function formatDate(d: DateInput): string {
  const date = toDate(d);
  return date ? dateFormatter.format(date) : EMPTY;
}

// 30 Oct 2026, 14:05
export function formatDateTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return EMPTY;
  const parts = Object.fromEntries(dateTimeFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

// 3 h ago, yesterday. Pair with formatDateTime in a title attribute.
export function formatRelative(d: DateInput, now: Date = new Date()): string {
  const date = toDate(d);
  if (!date) return EMPTY;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return formatDate(date);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

// 42 days
export function formatDays(n: number | null | undefined): string {
  if (n == null) return EMPTY;
  return `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
}

// 12.50% for rates; { whole: true } gives 68% for utilization.
export function formatPercent(n: number | null | undefined, options: { whole?: boolean } = {}): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return `${options.whole ? Math.round(n) : n.toFixed(2)}%`;
}

// +91 98765 43210
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return EMPTY;
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  if (local.length !== 10) return phone;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

// GJ05BX1234 → GJ 05 BX 1234 (thin spaces). Render in id-mono.
export function formatRegNo(reg: string | null | undefined): string {
  if (!reg) return EMPTY;
  const compact = reg.replace(/\s+/g, '').toUpperCase();
  const match = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (!match) return compact;
  return match.slice(1).filter(Boolean).join(' ');
}

const ACRONYMS = new Set(['CV', 'RC', 'RTO', 'DSA', 'EMI', 'PDD', 'AF', 'ID', 'KYC', 'GST', 'PAN', 'CIBIL']);

// USED_CV → Used CV. For codes that aren't in the status registry.
export function humanize(code: string | null | undefined): string {
  if (!code) return EMPTY;
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word, i) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      const lower = word.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

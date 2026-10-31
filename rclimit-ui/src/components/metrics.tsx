import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Ban, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatINR, formatINRCompact, formatPercent } from '@/lib/format';
import { amountInWords } from '@/lib/numberWords';
import { TONE_TEXT, utilizationTone, type Tone } from '@/lib/status';
import { useThresholds } from '@/theme/ThemeProvider';
import { Tooltip } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/feedback';

// §8.10 MetricCard, metric strip and UtilizationMeter.

interface MetricCardProps {
  label: string;
  value: ReactNode;
  // Exact value for a compact figure, shown in a tooltip.
  exact?: string;
  context?: ReactNode;
  contextTone?: Tone;
  icon?: LucideIcon;
  link?: { to: string; label: string };
  loading?: boolean;
  ariaLabel?: string;
  className?: string;
}

// The value stays in the foreground color; only the context line or icon carries tone.
export function MetricCard({ label, value, exact, context, contextTone, icon: Icon, link, loading, ariaLabel, className }: MetricCardProps) {
  const valueNode = (
    <p className="num mt-1 text-display text-foreground" aria-label={ariaLabel}>
      {value}
    </p>
  );
  return (
    <div className={cn('flex min-w-0 flex-col rounded-lg border bg-surface p-card shadow-xs dark:shadow-none', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-muted-foreground">{label}</p>
        {Icon && <Icon aria-hidden className={cn('size-4', contextTone ? TONE_TEXT[contextTone] : 'text-muted-foreground')} strokeWidth={1.75} />}
      </div>
      {loading ? <Skeleton className="mt-2 h-8 w-28" /> : exact ? <Tooltip content={exact}><div className="w-fit">{valueNode}</div></Tooltip> : valueNode}
      {context && <p className={cn('mt-1 text-caption', contextTone ? TONE_TEXT[contextTone] : 'text-muted-foreground')}>{context}</p>}
      {link && (
        <Link to={link.to} className="mt-2 inline-flex w-fit items-center gap-1 text-caption font-medium text-primary hover:underline">
          {link.label} <ArrowRight aria-hidden className="size-3" />
        </Link>
      )}
    </div>
  );
}

// A compact currency figure with the exact value in a tooltip and words for screen readers (§12).
export function CompactAmount(amount: number | null | undefined) {
  return {
    value: formatINRCompact(amount),
    exact: formatINR(amount),
    ariaLabel: amount ? amountInWords(amount) : undefined,
  };
}

// Grid from md up; a snap carousel on mobile (§8.10).
export function MetricStrip({ children, columns = 4 }: { children: ReactNode; columns?: 2 | 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0',
        '[&>*]:w-[85vw] [&>*]:shrink-0 [&>*]:snap-center md:[&>*]:w-auto',
        columns === 2 && 'md:grid-cols-2',
        columns === 3 && 'md:grid-cols-3',
        columns === 4 && 'md:grid-cols-2 lg:grid-cols-4',
        columns === 5 && 'md:grid-cols-3 xl:grid-cols-5',
      )}
    >
      {children}
    </div>
  );
}

const BAR_TONE: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
  progress: 'bg-primary',
};

interface UtilizationMeterProps {
  used: number;
  ceiling: number;
  label?: string;
  compact?: boolean;
  className?: string;
}

export function UtilizationMeter({ used, ceiling, label = 'Sub-limit', compact, className }: UtilizationMeterProps) {
  const thresholds = useThresholds();
  const pct = ceiling > 0 ? (used / ceiling) * 100 : used > 0 ? 100 : 0;
  const tone = utilizationTone(pct, thresholds);
  const over = pct > 100;
  const valueText = `${formatPercent(pct, { whole: true })} of ${label.toLowerCase()} used`;

  const bar = (
    <div
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div className={cn('h-full rounded-full transition-[width] duration-300', BAR_TONE[tone])} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );

  if (compact) {
    return (
      <Tooltip content={`${formatINR(used, { whole: true })} / ${formatINR(ceiling, { whole: true })}`}>
        <div className={cn('flex min-w-28 items-center gap-2', className)} tabIndex={0}>
          {bar}
          <span className={cn('num w-11 shrink-0 text-right text-caption', over ? 'text-danger' : 'text-muted-foreground')}>
            {formatPercent(pct, { whole: true })}
          </span>
          {over && <Ban aria-label="Over limit" className="size-3.5 shrink-0 text-danger" />}
        </div>
      </Tooltip>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-label text-muted-foreground">{label}</span>
        <span className={cn('num inline-flex items-center gap-1 text-caption font-medium', TONE_TEXT[tone])}>
          {over && <Ban aria-hidden className="size-3.5" />}
          {formatPercent(pct, { whole: true })}
        </span>
      </div>
      {bar}
      <p className="num text-caption text-muted-foreground">
        {formatINR(used, { whole: true })} / {formatINR(ceiling, { whole: true })}
      </p>
    </div>
  );
}

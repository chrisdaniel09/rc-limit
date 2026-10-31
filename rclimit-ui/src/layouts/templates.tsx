import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hooks/useMediaQuery';

// §7.3 page templates. Templates own spacing; pages never size themselves to the viewport.

interface PageHeaderProps {
  title: ReactNode;
  count?: number | null;
  description?: ReactNode;
  actions?: ReactNode;
  // Controls under the title row (segmented scope switch).
  children?: ReactNode;
}

export function PageHeader({ title, count, description, actions, children }: PageHeaderProps) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-baseline gap-2 text-title text-foreground">
            {title}
            {count != null && <span className="num text-sm font-normal text-muted-foreground" aria-live="polite">{count.toLocaleString('en-IN')}</span>}
          </h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// T3 record header: key + badges, a secondary line, and actions (primary rightmost).
export function RecordHeader({ title, badges, meta, actions, loading }: {
  title: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={cn('min-w-0 break-words text-title text-foreground', loading && 'text-muted-foreground')}>{title}</h1>
          {badges}
        </div>
        {meta && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="hidden flex-wrap items-center gap-2 md:flex lg:justify-end">{actions}</div>}
    </div>
  );
}

// Dot separator for record meta lines.
export function MetaSep() {
  return <span aria-hidden className="text-muted-foreground/60">·</span>;
}

// §8.21 StickyActionDock: on mobile, detail-page actions move to a frosted bar at the bottom.
export function StickyActionDock({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  if (!isMobile || !children) return null;
  return (
    <>
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-sticky flex items-center gap-2 border-t bg-background/80 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md [&>*]:flex-1">
        {children}
      </div>
    </>
  );
}

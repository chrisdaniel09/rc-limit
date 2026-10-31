import { useEffect, useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

interface WidgetCardProps {
  title: string;
  loading: boolean;
  hasData: boolean;
  error: string | null;
  onRefresh: () => void;
  fetchedAt?: number | null;
  actions?: ReactNode;
  children: ReactNode;
  // Renders children without the card frame (metric strips).
  bare?: boolean;
  className?: string;
}

// §10.2 widget chrome: title, "Updated 2 min ago", refresh; errors stay inside the widget with Retry.
export default function WidgetCard({ title, loading, hasData, error, onRefresh, fetchedAt, actions, children, bare, className }: WidgetCardProps) {
  // Re-render each minute so the "Updated" caption stays true.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const header = (
    <header className={cn('flex items-center justify-between gap-2', bare ? 'mb-3' : 'border-b px-card py-3')}>
      <div className="min-w-0">
        <h2 className="text-heading text-foreground">{title}</h2>
        {fetchedAt && <p className="text-caption text-muted-foreground">Updated {formatRelative(fetchedAt)}</p>}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <Tooltip content="Refresh">
          <Button variant="ghost" size="icon-sm" aria-label={`Refresh ${title}`} onClick={onRefresh} disabled={loading}>
            <RotateCw className={cn(loading && 'animate-spin')} />
          </Button>
        </Tooltip>
      </div>
    </header>
  );

  const body = error ? (
    <Alert tone="danger" title={`${title} didn't load`} action={<Button variant="outline" size="sm" onClick={onRefresh}>Retry</Button>}>{error}</Alert>
  ) : loading && !hasData ? (
    <Skeleton className="h-28 w-full" />
  ) : children;

  if (bare) {
    return <section aria-label={title} className={className}>{header}{body}</section>;
  }
  return (
    <section aria-label={title} className={cn('flex flex-col rounded-lg border bg-surface shadow-xs dark:shadow-none', className)}>
      {header}
      <div className="min-h-0 flex-1 p-card">{body}</div>
    </section>
  );
}

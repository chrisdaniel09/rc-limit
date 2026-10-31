import type { HTMLAttributes, ReactNode } from 'react';
import { Inbox, Lock, SearchX, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// §8.17 Skeleton / progress, §8.18 EmptyState, §8.10 Card.

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

// 2 px indeterminate bar shown under a table header while refetching.
export function ProgressBar({ active, className }: { active: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn('relative h-0.5 overflow-hidden', className)}>
      {active && <div className="absolute inset-y-0 w-1/3 bg-primary animate-progress" />}
    </div>
  );
}

const EMPTY_ICONS: Record<'no-data' | 'no-results' | 'no-access', LucideIcon> = {
  'no-data': Inbox,
  'no-results': SearchX,
  'no-access': Lock,
};

interface EmptyStateProps {
  variant?: 'no-data' | 'no-results' | 'no-access';
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ variant = 'no-data', icon, title, description, action, className }: EmptyStateProps) {
  const Icon = icon ?? EMPTY_ICONS[variant];
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon aria-hidden className="size-6 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-subheading text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  // Removes body padding, for tables that run edge to edge.
  flush?: boolean;
}

export function Card({ title, description, actions, flush, className, children, ...props }: CardProps) {
  return (
    <section className={cn('rounded-lg border bg-surface shadow-xs dark:shadow-none', className)} {...props}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-card py-3">
          <div className="min-w-0">
            {title && <h2 className="text-heading text-foreground">{title}</h2>}
            {description && <p className="text-caption text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && 'p-card')}>{children}</div>
    </section>
  );
}

// Description list for record overviews: label / value pairs in a responsive grid.
export function DescriptionList({ items, columns = 3 }: {
  items: { label: ReactNode; value: ReactNode; hidden?: boolean; className?: string }[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2', columns >= 3 && 'lg:grid-cols-3', columns === 4 && 'xl:grid-cols-4')}>
      {items.filter((i) => !i.hidden).map((item, idx) => (
        <div key={idx} className={cn('min-w-0', item.className)}>
          <dt className="text-label text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Muted em dash for empty values (§5.4).
export function Empty({ children = '—' }: { children?: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

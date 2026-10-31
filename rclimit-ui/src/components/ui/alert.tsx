import type { HTMLAttributes, ReactNode } from 'react';
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<AlertTone, { box: string; icon: LucideIcon; iconClass: string }> = {
  info: { box: 'border-info/30 bg-info-subtle', icon: Info, iconClass: 'text-info' },
  success: { box: 'border-success/30 bg-success-subtle', icon: CircleCheck, iconClass: 'text-success' },
  warning: { box: 'border-warning/30 bg-warning-subtle', icon: TriangleAlert, iconClass: 'text-warning' },
  danger: { box: 'border-danger/30 bg-danger-subtle', icon: OctagonAlert, iconClass: 'text-danger' },
};

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: AlertTone;
  title?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}

// §8.13 Alert / banner.
export function Alert({ tone = 'info', title, action, icon, className, children, ...props }: AlertProps) {
  const t = TONE[tone];
  const Icon = icon ?? t.icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm text-foreground', t.box, className)} {...props}>
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', t.iconClass)} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 text-muted-foreground')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

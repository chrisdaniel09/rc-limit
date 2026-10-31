import { cn } from '../lib/cn';
import { getStatus, type StatusDomain } from '../lib/status';
import Badge from './Badge';

interface StatusBadgeProps {
  status: string | null | undefined;
  domain?: StatusDomain;
  // Inside table rows the attention pulse is off; the row gets a stripe instead (§6.3).
  inTable?: boolean;
  className?: string;
}

// Every status is shown with its icon and label, never color alone (§6, §12).
export default function StatusBadge({ status, domain, inTable = false, className }: StatusBadgeProps) {
  const info = getStatus(status, domain);
  return (
    <Badge
      text={info.label}
      variant={info.tone}
      icon={info.icon}
      className={cn(info.attention && !inTable && 'animate-attention motion-reduce:ring-2 motion-reduce:ring-danger', className)}
    />
  );
}

interface BadgeProps {
  text: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const variantClasses: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

export function statusVariant(status: string): BadgeProps['variant'] {
  const s = status?.toUpperCase() ?? '';
  if (['ACTIVE', 'GREEN', 'ON_TIME', 'PASSED', 'VERIFIED', 'CLOSED', 'QUALIFIED', 'CONVERTED'].includes(s)) return 'success';
  if (['AMBER', 'WARNING', 'WARNING_ZONE', 'FLAGGED', 'IN_PROGRESS'].includes(s)) return 'warning';
  if (['RED', 'OVERDUE', 'OVERDUE_LOCK', 'STOP_SUPPLY_LOCKED', 'DEFAULTED', 'FAILED', 'REJECTED', 'SUSPENDED'].includes(s)) return 'danger';
  if (['DISBURSED_RC_PENDING', 'SANCTIONED', 'RC_SUBMITTED', 'PENDING', 'NEW'].includes(s)) return 'info';
  return 'neutral';
}

export default function Badge({ text, variant = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}>
      {text}
    </span>
  );
}

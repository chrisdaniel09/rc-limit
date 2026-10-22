export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function statusVariant(status: string): BadgeVariant {
  const s = status?.toUpperCase() ?? '';
  if (['ACTIVE', 'GREEN', 'ON_TIME', 'PASSED', 'VERIFIED', 'CLOSED', 'QUALIFIED', 'CONVERTED'].includes(s)) return 'success';
  if (['AMBER', 'WARNING', 'WARNING_ZONE', 'FLAGGED', 'IN_PROGRESS'].includes(s)) return 'warning';
  if (['RED', 'OVERDUE', 'OVERDUE_LOCK', 'STOP_SUPPLY_LOCKED', 'DEFAULTED', 'FAILED', 'REJECTED', 'SUSPENDED'].includes(s)) return 'danger';
  if (['DISBURSED_RC_PENDING', 'SANCTIONED', 'RC_SUBMITTED', 'PENDING', 'NEW'].includes(s)) return 'info';
  return 'neutral';
}

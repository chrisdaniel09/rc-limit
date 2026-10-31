import { Link } from 'react-router-dom';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState } from '@/components/ui/feedback';
import { formatDays, formatRegNo } from '@/lib/format';
import { getStatus, TONE_TEXT } from '@/lib/status';
import { cn } from '@/lib/cn';
import WidgetCard from './WidgetCard';

interface RcAgingAlert {
  loanId: string;
  applicationNumber: string;
  customerName: string;
  vehicleRegNo: string;
  agingDays: number;
  agingStatus: string;
}

const TOP = 10;

// §10.2 row 2: RC aging alerts, longest first, top 10 + "View all".
export default function RcAgingWidget() {
  const { data, loading, error, refetch, fetchedAt } = useFetch<RcAgingAlert[]>('/api/v1/dashboard/rc-aging', [], { staleAfter: LIST_STALE_MS });
  const alerts = [...(data ?? [])].sort((a, b) => b.agingDays - a.agingDays);

  return (
    <WidgetCard
      title="RC aging alerts"
      loading={loading}
      hasData={data !== null}
      error={error}
      onRefresh={refetch}
      fetchedAt={fetchedAt}
      actions={alerts.length > TOP && <Link to="/loans?rcAging=OVERDUE_LOCK" className="mr-1 text-caption font-medium text-primary hover:underline">View all {alerts.length}</Link>}
    >
      {alerts.length === 0 ? (
        <EmptyState title="No RC aging alerts" description="Every disbursed loan's RC is on time." className="py-6" />
      ) : (
        <div className="-mx-card -mb-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-label text-muted-foreground">
              <tr>
                <th scope="col" className="h-9 px-cell font-medium">Application #</th>
                <th scope="col" className="px-cell font-medium">Customer</th>
                <th scope="col" className="hidden px-cell font-medium md:table-cell">Vehicle</th>
                <th scope="col" className="px-cell text-right font-medium">Days</th>
                <th scope="col" className="px-cell font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {alerts.slice(0, TOP).map((a) => {
                const tone = getStatus(a.agingStatus).tone;
                return (
                  <tr
                    key={a.loanId}
                    className="relative h-row hover:bg-muted/60"
                    style={tone === 'danger' ? { boxShadow: 'inset 3px 0 0 var(--danger)' } : undefined}
                  >
                    <td className="px-cell">
                      <Link to={`/loans/${a.loanId}`} className="id-mono font-medium after:absolute after:inset-0 hover:underline">{a.applicationNumber}</Link>
                    </td>
                    <td className="max-w-48 truncate px-cell">{a.customerName}</td>
                    <td className="id-mono hidden whitespace-nowrap px-cell md:table-cell">{formatRegNo(a.vehicleRegNo)}</td>
                    <td className={cn('num whitespace-nowrap px-cell text-right font-medium', TONE_TEXT[tone])}>{formatDays(a.agingDays)}</td>
                    <td className="px-cell"><StatusBadge status={a.agingStatus} inTable /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

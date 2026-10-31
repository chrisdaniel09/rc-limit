import { Ban, FileText, Landmark, Timer } from 'lucide-react';
import { LIST_STALE_MS, useFetch } from '@/hooks/useFetch';
import { CompactAmount, MetricCard, MetricStrip } from '@/components/metrics';
import WidgetCard from './WidgetCard';

interface LoanSummary {
  totalLoans: number;
  activeLoans: number;
  totalSanctioned: number;
  stopSupplyDealers: number;
}

// §10.2 row 1: metric strip.
export default function LoanStatsWidget() {
  const { data, loading, error, refetch, fetchedAt } = useFetch<LoanSummary>('/api/v1/dashboard/summary', [], { staleAfter: LIST_STALE_MS });
  const sanctioned = CompactAmount(data?.totalSanctioned ?? 0);
  const stop = data?.stopSupplyDealers ?? 0;

  return (
    <WidgetCard title="Loans" bare loading={loading} hasData={data !== null} error={error} onRefresh={refetch} fetchedAt={fetchedAt}>
      <MetricStrip columns={4}>
        <MetricCard label="Total loans" icon={FileText} value={(data?.totalLoans ?? 0).toLocaleString('en-IN')} context="All time" link={{ to: '/loans', label: 'View loans' }} />
        <MetricCard label="Active loans" icon={Timer} value={(data?.activeLoans ?? 0).toLocaleString('en-IN')} context="RC pending" link={{ to: '/loans?loanStatus=DISBURSED', label: 'View active' }} />
        <MetricCard label="Total sanctioned" icon={Landmark} value={sanctioned.value} exact={sanctioned.exact} ariaLabel={sanctioned.ariaLabel} context="Across all lenders" />
        <MetricCard
          label="Stop-supply dealers"
          icon={Ban}
          value={stop.toLocaleString('en-IN')}
          context={stop > 0 ? 'Currently locked' : 'None locked'}
          contextTone={stop > 0 ? 'danger' : 'success'}
          link={stop > 0 ? { to: '/customers?stopSupply=true', label: `View ${stop}` } : undefined}
        />
      </MetricStrip>
    </WidgetCard>
  );
}

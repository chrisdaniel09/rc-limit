import { useFetch } from '../../../hooks/useFetch';
import StatCard from '../../../components/StatCard';
import WidgetCard from './WidgetCard';

interface LoanSummary {
  totalLoans: number;
  activeLoans: number;
  totalSanctioned: number;
  stopSupplyDealers: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function LoanStatsWidget() {
  const { data, loading, error, refetch } = useFetch<LoanSummary>('/api/v1/dashboard/summary');

  return (
    <WidgetCard title="Loan Stats" loading={loading} hasData={data !== null} error={error} onRefresh={refetch}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Loans" value={data?.totalLoans ?? 0} subtitle="All time" />
        <StatCard title="Active Loans" value={data?.activeLoans ?? 0} subtitle="RC Pending" color="text-blue-600" />
        <StatCard title="Total Sanctioned" value={formatCurrency(data?.totalSanctioned ?? 0)} subtitle="Across all lenders" color="text-green-600" />
        <StatCard title="Stop Supply Dealers" value={data?.stopSupplyDealers ?? 0} subtitle="Currently locked" color="text-red-600" />
      </div>
    </WidgetCard>
  );
}

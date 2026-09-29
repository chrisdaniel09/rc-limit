import { useFetch } from '../../hooks/useFetch';
import StatCard from '../../components/StatCard';
import Badge, { statusVariant } from '../../components/Badge';

interface DashboardData {
  totalLoans: number;
  activeLoans: number;
  totalSanctioned: number;
  stopSupplyDealers: number;
  rcAgingAlerts: {
    loanNumber: string;
    customerName: string;
    vehicleReg: string;
    agingDays: number;
    agingStatus: string;
  }[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function DashboardPage() {
  const { data, loading } = useFetch<DashboardData>('/api/v1/dashboard');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-lg animate-pulse border border-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  const d = data ?? { totalLoans: 0, activeLoans: 0, totalSanctioned: 0, pendingRcCount: 0, stopSupplyDealers: 0, rcAgingAlerts: [] };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Loans" value={d.totalLoans} subtitle="All time" />
        <StatCard title="Active Loans" value={d.activeLoans} subtitle="RC Pending" color="text-blue-600" />
        <StatCard title="Total Sanctioned" value={formatCurrency(d.totalSanctioned)} subtitle="Across all lenders" color="text-green-600" />
        <StatCard title="Stop Supply Dealers" value={d.stopSupplyDealers} subtitle="Currently locked" color="text-red-600" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">RC Aging Alerts</h2>
        {d.rcAgingAlerts.length === 0 ? (
          <p className="text-sm text-gray-500">No aging alerts</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {d.rcAgingAlerts.map((alert, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{alert.loanNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{alert.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{alert.vehicleReg}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.agingDays}</td>
                    <td className="px-4 py-3"><Badge text={alert.agingStatus} variant={statusVariant(alert.agingStatus)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

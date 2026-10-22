import { useFetch } from '../../../hooks/useFetch';
import Badge from '../../../components/Badge';
import { statusVariant } from '../../../components/badgeVariants';
import WidgetCard from './WidgetCard';

interface RcAgingAlert {
  loanId: string;
  loanNumber: string | null;
  customerName: string;
  vehicleRegNo: string;
  agingDays: number;
  agingStatus: string;
}

export default function RcAgingWidget() {
  const { data, loading, error, refetch } = useFetch<RcAgingAlert[]>('/api/v1/dashboard/rc-aging');
  const alerts = data ?? [];

  return (
    <WidgetCard title="RC Aging Alerts" loading={loading} hasData={data !== null} error={error} onRefresh={refetch}>
      {alerts.length === 0 ? (
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
              {alerts.map((alert) => (
                <tr key={alert.loanId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{alert.loanNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{alert.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{alert.vehicleRegNo}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{alert.agingDays}</td>
                  <td className="px-4 py-3"><Badge text={alert.agingStatus} variant={statusVariant(alert.agingStatus)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetCard>
  );
}

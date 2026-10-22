import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../hooks/useAuth';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import { statusVariant } from '../../components/badgeVariants';

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

interface MyDashboardData {
  totalAssigned: number;
  openLeads: number;
  convertedLeads: number;
  byStatus: { status: string; count: number }[];
}

interface MyLead {
  leadId: string;
  applicantName: string | null;
  whatsappPhoneNumber: string;
  vehicleRegistrationNumber: string | null;
  leadStatus: string;
  cibilCheckStatus: string;
  rcCheckStatus: string;
  createdAt: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function CompanyDashboard() {
  const { data, loading } = useFetch<DashboardData>('/api/v1/dashboard');

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-white rounded-lg animate-pulse border border-gray-200" />
        ))}
      </div>
    );
  }

  const d = data ?? { totalLoans: 0, activeLoans: 0, totalSanctioned: 0, stopSupplyDealers: 0, rcAgingAlerts: [] };

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

function MyLeads() {
  const { data: summary, loading: summaryLoading } = useFetch<MyDashboardData>('/api/v1/dashboard/me');
  const { data: leads, loading: leadsLoading } = useFetch<MyLead[]>('/api/v1/leads?assignedToMe=true');

  const s = summary ?? { totalAssigned: 0, openLeads: 0, convertedLeads: 0, byStatus: [] };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="My Leads" value={summaryLoading ? '…' : s.totalAssigned} subtitle="Assigned to you" />
        <StatCard title="Open Leads" value={summaryLoading ? '…' : s.openLeads} subtitle="Not yet converted" color="text-blue-600" />
        <StatCard title="Converted" value={summaryLoading ? '…' : s.convertedLeads} subtitle="Turned into customers" color="text-green-600" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Leads</h2>
        {leadsLoading ? (
          <div className="h-24 bg-gray-100 rounded animate-pulse" />
        ) : !leads || leads.length === 0 ? (
          <p className="text-sm text-gray-500">No leads are assigned to you.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CIBIL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.leadId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                      <Link to={`/leads/${lead.leadId}`} className="hover:underline">
                        {lead.applicantName ?? 'Unnamed lead'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{lead.whatsappPhoneNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{lead.vehicleRegistrationNumber ?? '-'}</td>
                    <td className="px-4 py-3"><Badge text={lead.cibilCheckStatus} variant={statusVariant(lead.cibilCheckStatus)} /></td>
                    <td className="px-4 py-3"><Badge text={lead.rcCheckStatus} variant={statusVariant(lead.rcCheckStatus)} /></td>
                    <td className="px-4 py-3"><Badge text={lead.leadStatus} variant={statusVariant(lead.leadStatus)} /></td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(lead.createdAt)}</td>
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

export default function DashboardPage() {
  const { hasRight } = useAuth();

  return (
    <div className="space-y-6">
      {hasRight('loans.view') && <CompanyDashboard />}
      <MyLeads />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useFetch } from '../../../hooks/useFetch';
import StatCard from '../../../components/StatCard';
import Badge from '../../../components/Badge';
import { statusVariant } from '../../../components/badgeVariants';
import WidgetCard from './WidgetCard';

interface MyLeadsSummary {
  totalAssigned: number;
  openLeads: number;
  convertedLeads: number;
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

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function MyLeadsWidget() {
  const summary = useFetch<MyLeadsSummary>('/api/v1/dashboard/me');
  // Shows the newest 25 assigned leads. The summary card above carries the full count.
  const leads = useFetch<MyLead[]>('/api/v1/leads?assignedToMe=true&pageSize=25');

  const refresh = () => {
    summary.refetch();
    leads.refetch();
  };
  const loading = summary.loading || leads.loading;
  const error = summary.error ?? leads.error;
  const s = summary.data;

  return (
    <WidgetCard title="My Leads" loading={loading} hasData={s !== null && leads.data !== null} error={error} onRefresh={refresh}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="My Leads" value={s?.totalAssigned ?? 0} subtitle="Assigned to you" />
          <StatCard title="Open Leads" value={s?.openLeads ?? 0} subtitle="Not yet converted" color="text-blue-600" />
          <StatCard title="Converted" value={s?.convertedLeads ?? 0} subtitle="Turned into customers" color="text-green-600" />
        </div>

        {!leads.data || leads.data.length === 0 ? (
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
                {leads.data.map((lead) => (
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
    </WidgetCard>
  );
}

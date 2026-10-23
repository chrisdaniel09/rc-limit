import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import { statusVariant } from '../../components/badgeVariants';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import PhoneInput from '../../components/PhoneInput';
import { toPhoneNumber } from '../../utils/phone';
import { useListState } from '../../hooks/useListState';
import Pagination from '../../components/Pagination';

interface Lead {
  leadId: string;
  applicantName: string;
  whatsappPhoneNumber: string;
  contactPhone: string | null;
  requestedLoanAmount: number | null;
  vehicleRegistrationNumber: string;
  leadSource: string;
  referredByUserId: string | null;
  referredByUserName: string | null;
  vahanValidationStatus: string;
  leadStatus: string;
  notes: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  cibilCheckStatus: string;
  rcCheckStatus: string;
  cibilScorePreview: number | null;
  convertedCustomerId: string | null;
  createdAt: string;
}

interface StaffUser {
  userId: string;
  fullName: string | null;
  email: string | null;
}

const LEAD_SOURCES = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'CALL_IN', label: 'Call-In' },
  { value: 'WALK_IN', label: 'Walk-In' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'OTHER', label: 'Other' },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'REJECTED', label: 'Rejected' },
];

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const list = useListState({
    storageKey: 'leads.pageSize',
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    initialFilters: { assignedToMe: '', leadStatus: '' },
  });
  const scope = list.filters.assignedToMe === 'true' ? 'mine' : 'all';
  const { data, meta, loading, refetch } = useFetch<Lead[]>(`/api/v1/leads?${list.query}`);
  const { data: users } = useFetch<StaffUser[]>('/api/v1/users/lookup');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    leadSource: 'WALK_IN', referredByUserId: '',
    applicantName: '', whatsappPhoneNumber: '', contactPhone: '',
    requestedLoanAmount: '', vehicleRegistrationNumber: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Lead>[] = [
    { key: 'applicantName', header: 'Applicant', sortKey: 'applicantName' },
    { key: 'leadSource', header: 'Source', sortKey: 'leadSource', render: (l) => <Badge text={l.leadSource} variant="neutral" /> },
    // Not sortable: the name is resolved from the Identity module after paging, so the database cannot order by it.
    { key: 'assignedToUserName', header: 'Assigned To', render: (l) => l.assignedToUserName ?? '-' },
    { key: 'cibilCheckStatus', header: 'CIBIL', sortKey: 'cibilCheckStatus', render: (l) => <Badge text={l.cibilCheckStatus} variant={statusVariant(l.cibilCheckStatus)} /> },
    { key: 'rcCheckStatus', header: 'RC', sortKey: 'rcCheckStatus', render: (l) => <Badge text={l.rcCheckStatus} variant={statusVariant(l.rcCheckStatus)} /> },
    { key: 'leadStatus', header: 'Status', sortKey: 'leadStatus', render: (l) => <Badge text={l.leadStatus} variant={statusVariant(l.leadStatus)} /> },
    { key: 'createdAt', header: 'Created', sortKey: 'createdAt', render: (l) => formatDate(l.createdAt) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/leads', {
        leadSource: form.leadSource,
        referredByUserId: form.referredByUserId || null,
        applicantName: form.applicantName,
        whatsappPhoneNumber: toPhoneNumber(form.whatsappPhoneNumber),
        contactPhone: toPhoneNumber(form.contactPhone),
        requestedLoanAmount: form.requestedLoanAmount ? parseFloat(form.requestedLoanAmount) : null,
        vehicleRegistrationNumber: form.vehicleRegistrationNumber || null,
        notes: form.notes || null,
      });
      setShowModal(false);
      setForm({
        leadSource: 'WALK_IN', referredByUserId: '',
        applicantName: '', whatsappPhoneNumber: '', contactPhone: '',
        requestedLoanAmount: '', vehicleRegistrationNumber: '', notes: '',
      });
      // Newest leads sort first, so show page 1 where the new lead appears. Changing the page refetches on its own.
      if (list.page === 1) refetch();
      else list.setPage(1);
    } catch (err) {
      console.error('Failed to create lead:', err);
      alert('Failed to create lead. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const userOptions = users?.map((u) => ({
    value: u.userId,
    label: u.fullName || u.email || u.userId,
  })) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
          <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
            {([['all', 'All Leads'], ['mine', 'My Leads']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => list.updateFilter('assignedToMe', value === 'mine' ? 'true' : '')}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  scope === value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Lead
        </button>
      </div>

      <div className="mb-4">
        <select
          value={list.filters.leadStatus}
          onChange={(e) => list.updateFilter('leadStatus', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          aria-label="Filter by lead status"
        >
          <option value="">All statuses</option>
          {LEAD_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        searchPlaceholder="Search applicant, phone or vehicle..."
        onRowClick={(lead) => navigate(`/leads/${lead.leadId}`)}
        server={{
          searchValue: list.searchInput,
          onSearchChange: list.setSearchInput,
          sortBy: list.sortBy,
          sortDir: list.sortDir,
          onSort: list.updateSort,
          footer: (
            <Pagination
              meta={meta}
              pageSize={list.pageSize}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          ),
        }}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Lead">
        <form onSubmit={handleSubmit}>
          <FormField label="Applicant Name" value={form.applicantName} onChange={(v) => setForm({ ...form, applicantName: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Lead Source" value={form.leadSource} onChange={(v) => setForm({ ...form, leadSource: v })} required options={LEAD_SOURCES} />
            <FormField label="Brought In By (Staff)" value={form.referredByUserId} onChange={(v) => setForm({ ...form, referredByUserId: v })} options={userOptions} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PhoneInput label="WhatsApp Phone" value={form.whatsappPhoneNumber} onChange={(v) => setForm({ ...form, whatsappPhoneNumber: v })} required />
            <PhoneInput label="Contact Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
          </div>
          <FormField label="Requested Loan Amount (₹)" type="number" value={form.requestedLoanAmount} onChange={(v) => setForm({ ...form, requestedLoanAmount: v })} />
          <FormField label="Vehicle Registration #" value={form.vehicleRegistrationNumber} onChange={(v) => setForm({ ...form, vehicleRegistrationNumber: v })} placeholder="GJ05BX6637" />
          <FormField label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Any additional context about the lead..." />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

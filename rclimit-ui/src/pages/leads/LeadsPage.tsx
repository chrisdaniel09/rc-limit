import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

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

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const { data, loading, refetch } = useFetch<Lead[]>('/api/v1/leads');
  const { data: users } = useFetch<StaffUser[]>('/api/v1/users/lookup');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    leadSource: 'WALK_IN', referredByUserId: '',
    applicantName: '', whatsappPhoneNumber: '', contactPhone: '',
    requestedLoanAmount: '', vehicleRegistrationNumber: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Lead>[] = [
    { key: 'applicantName', header: 'Applicant' },
    { key: 'leadSource', header: 'Source', render: (l) => <Badge text={l.leadSource} variant="neutral" /> },
    { key: 'assignedToUserName', header: 'Assigned To', render: (l) => l.assignedToUserName ?? '-' },
    { key: 'cibilCheckStatus', header: 'CIBIL', render: (l) => <Badge text={l.cibilCheckStatus} variant={statusVariant(l.cibilCheckStatus)} /> },
    { key: 'rcCheckStatus', header: 'RC', render: (l) => <Badge text={l.rcCheckStatus} variant={statusVariant(l.rcCheckStatus)} /> },
    { key: 'leadStatus', header: 'Status', render: (l) => <Badge text={l.leadStatus} variant={statusVariant(l.leadStatus)} /> },
    { key: 'createdAt', header: 'Created', render: (l) => formatDate(l.createdAt) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/leads', {
        leadSource: form.leadSource,
        referredByUserId: form.referredByUserId || null,
        applicantName: form.applicantName,
        whatsappPhoneNumber: form.whatsappPhoneNumber,
        contactPhone: form.contactPhone || null,
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
      refetch();
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
        <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Lead
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        searchPlaceholder="Search leads..."
        onRowClick={(lead) => navigate(`/leads/${lead.leadId}`)}
      />

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Lead">
        <form onSubmit={handleSubmit}>
          <FormField label="Applicant Name" value={form.applicantName} onChange={(v) => setForm({ ...form, applicantName: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Lead Source" value={form.leadSource} onChange={(v) => setForm({ ...form, leadSource: v })} required options={LEAD_SOURCES} />
            <FormField label="Brought In By (Staff)" value={form.referredByUserId} onChange={(v) => setForm({ ...form, referredByUserId: v })} options={userOptions} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="WhatsApp Phone" value={form.whatsappPhoneNumber} onChange={(v) => setForm({ ...form, whatsappPhoneNumber: v })} required placeholder="+919876543210" />
            <FormField label="Contact Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} placeholder="Alternate number" />
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

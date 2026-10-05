import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPut, apiPost } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
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
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead;
  users: StaffUser[];
  onLeadUpdated: () => void;
}

const LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'REJECTED', label: 'Rejected' },
];

const CHECK_STATUSES = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
];

const getStatusIcon = (status: string) => {
  if (status === 'PASSED') return '✓';
  if (status === 'FAILED') return '✗';
  if (status === 'IN_PROGRESS') return '⏱';
  return '○';
};

const getStatusColor = (status: string) => {
  if (status === 'PASSED') return 'bg-green-100 text-green-800';
  if (status === 'FAILED') return 'bg-red-100 text-red-800';
  if (status === 'NOT_STARTED') return 'bg-gray-100 text-gray-800';
  return 'bg-amber-100 text-amber-800';
};

export default function LeadDetailModal({ isOpen, onClose, lead, users, onLeadUpdated }: Props) {
  const navigate = useNavigate();
  const { hasRight } = useAuth();
  const [loading, setLoading] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState(lead.assignedToUserId ?? '');
  const [leadStatus, setLeadStatus] = useState(lead.leadStatus);
  const [cibilStatus, setCibilStatus] = useState(lead.cibilCheckStatus);
  const [cibilScore, setCibilScore] = useState(lead.cibilScorePreview?.toString() ?? '');
  const [cibilRemarks, setCibilRemarks] = useState('');
  const [rcStatus, setRcStatus] = useState(lead.rcCheckStatus);
  const [rcRemarks, setRcRemarks] = useState('');
  const [customerType, setCustomerType] = useState('DEALER');
  const [assignedCeiling, setAssignedCeiling] = useState('');
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);

  const userOptions = users.map(u => ({ value: u.userId, label: u.fullName || u.userId }));

  const isCibilPassed = cibilStatus === 'PASSED';
  const isRcPassed = rcStatus === 'PASSED';
  const isQualified = leadStatus === 'QUALIFIED';
  const canConvert = isCibilPassed && isRcPassed && isQualified && !lead.convertedCustomerId;

  const handleStatusChange = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      await apiPut(`/api/v1/leads/${lead.leadId}/status`, { status: leadStatus });
      onLeadUpdated();
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordCibilCheck = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      await apiPost(`/api/v1/leads/${lead.leadId}/checks`, {
        checkType: 'CIBIL',
        status: cibilStatus,
        score: cibilScore ? parseInt(cibilScore) : null,
        remarks: cibilRemarks,
      });
      setCibilScore('');
      setCibilRemarks('');
      onLeadUpdated();
    } catch (err) {
      alert('Failed to record CIBIL check');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordRcCheck = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      await apiPost(`/api/v1/leads/${lead.leadId}/checks`, {
        checkType: 'RC',
        status: rcStatus,
        remarks: rcRemarks,
      });
      setRcRemarks('');
      onLeadUpdated();
    } catch (err) {
      alert('Failed to record RC check');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      const response = await apiPost<{ customerId: string }>(`/api/v1/leads/${lead.leadId}/convert`, {
        customerType,
        assignedCeiling: parseFloat(assignedCeiling),
        maxPendingRcAllowed: 5,
      });
      navigate(`/customers/${response.customerId}`);
    } catch (err) {
      alert('Failed to convert lead');
    } finally {
      setLoading(false);
      setShowConvertConfirm(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* HEADER WITH QUALIFICATION PIPELINE */}
        <div className="border-b bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lead: {lead.applicantName || 'Unknown'}</h2>
              <p className="text-xs text-gray-600 mt-1">Manage assignment, verify applicant, and convert to customer</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Qualification Checklist Banner */}
          <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 text-xs">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-white ${isCibilPassed ? 'bg-green-500' : 'bg-red-500'}`}>
                {getStatusIcon(cibilStatus)}
              </span>
              <div>
                <span className="text-gray-600 block">CIBIL</span>
                <span className={`text-xs font-semibold ${isCibilPassed ? 'text-green-700' : 'text-red-600'}`}>{cibilStatus}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-white ${isRcPassed ? 'bg-green-500' : 'bg-amber-500'}`}>
                {getStatusIcon(rcStatus)}
              </span>
              <div>
                <span className="text-gray-600 block">RC</span>
                <span className={`text-xs font-semibold ${isRcPassed ? 'text-green-700' : 'text-amber-600'}`}>{rcStatus}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-white ${isQualified ? 'bg-green-500' : 'bg-gray-400'}`}>
                {getStatusIcon(leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}
              </span>
              <div>
                <span className="text-gray-600 block">Status</span>
                <span className={`text-xs font-semibold ${isQualified ? 'text-green-700' : 'text-gray-700'}`}>{leadStatus}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2-COLUMN MAIN CONTENT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto flex-1">

          {/* LEFT COLUMN: Assignment & Status */}
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Lead Assignment</h3>
              <FormField
                label="Assign to Team Member"
                value={assignedToUserId}
                onChange={setAssignedToUserId}
                options={userOptions}
                disabled={!hasRight('leads.edit')}
              />
            </div>

            <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Lead Status</h3>
              <FormField
                label="Lifecycle Status"
                value={leadStatus}
                onChange={setLeadStatus}
                options={LEAD_STATUSES}
                disabled={!hasRight('leads.edit') || !!lead.convertedCustomerId}
              />
            </div>
          </div>

          {/* RIGHT COLUMN: Verification Checks */}
          <div className="space-y-4">

            {/* CIBIL Check */}
            <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-semibold text-gray-800">CIBIL Verification</h3>
                <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(cibilStatus)}`}>
                  {cibilStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  label="Status"
                  value={cibilStatus}
                  onChange={setCibilStatus}
                  options={CHECK_STATUSES}
                  disabled={!hasRight('leads.edit')}
                />
                <FormField
                  label="Score"
                  value={cibilScore}
                  onChange={setCibilScore}
                  type="number"
                  placeholder="750"
                  disabled={!hasRight('leads.edit')}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={cibilRemarks}
                  onChange={(e) => setCibilRemarks(e.target.value)}
                  disabled={!hasRight('leads.edit')}
                  placeholder="Credit history notes..."
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <button
                onClick={handleRecordCibilCheck}
                disabled={loading || !hasRight('leads.edit')}
                className="w-full px-2 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Record CIBIL Check
              </button>
            </div>

            {/* RC Check */}
            <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-sm font-semibold text-gray-800">RC Verification</h3>
                <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(rcStatus)}`}>
                  {rcStatus}
                </span>
              </div>
              <FormField
                label="Status"
                value={rcStatus}
                onChange={setRcStatus}
                options={CHECK_STATUSES}
                disabled={!hasRight('leads.edit')}
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={rcRemarks}
                  onChange={(e) => setRcRemarks(e.target.value)}
                  disabled={!hasRight('leads.edit')}
                  placeholder="Vehicle registration notes..."
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                />
              </div>
              <button
                onClick={handleRecordRcCheck}
                disabled={loading || !hasRight('leads.edit')}
                className="w-full px-2 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Record RC Check
              </button>
            </div>
          </div>
        </div>

        {/* UNIFIED ACTION FOOTER */}
        <div className="border-t bg-gray-50 px-6 py-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 rounded-md border border-gray-300 bg-white hover:bg-gray-100"
          >
            Cancel
          </button>

          <div className="flex gap-2">
            {!lead.convertedCustomerId && (
              <>
                <button
                  onClick={handleStatusChange}
                  disabled={loading || !hasRight('leads.edit')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
                >
                  Save Changes
                </button>

                <button
                  disabled={!canConvert || loading}
                  onClick={() => setShowConvertConfirm(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 ${
                    canConvert
                      ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Convert to Customer →
                </button>
              </>
            )}
            {lead.convertedCustomerId && (
              <a
                href={`/customers/${lead.convertedCustomerId}`}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              >
                View Customer
              </a>
            )}
          </div>
        </div>

        {/* Conversion Confirmation Modal */}
        {showConvertConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-lg">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm">
              <h3 className="text-base font-bold text-gray-900 mb-3">Convert to Customer</h3>
              <p className="text-sm text-gray-600 mb-4">Customer Type and Sub-Limit Ceiling required.</p>
              <div className="space-y-3 mb-4">
                <FormField
                  label="Customer Type"
                  value={customerType}
                  onChange={setCustomerType}
                  options={[
                    { value: 'DEALER', label: 'Dealer' },
                    { value: 'INDIVIDUAL', label: 'Individual' },
                  ]}
                />
                <FormField
                  label="Sub-Limit Ceiling (₹)"
                  value={assignedCeiling}
                  onChange={setAssignedCeiling}
                  type="number"
                  placeholder="500000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConvertConfirm(false)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 rounded-md border border-gray-300 bg-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvert}
                  disabled={loading || !assignedCeiling}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

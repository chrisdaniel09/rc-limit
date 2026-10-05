import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPut, apiPost } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import FormField from '../../components/FormField';
import CommentsPanel from '../../components/CommentsPanel';

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

interface CheckLog {
  logId: string;
  checkType: string;
  status: string;
  score: number | null;
  remarks: string | null;
  source: string;
  performedByUserId: string;
  performedByUserName: string | null;
  createdAt: string;
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
  if (status === 'PASSED') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'FAILED') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'NOT_STARTED') return 'bg-gray-100 text-gray-800 border-gray-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

export default function LeadDetailPage() {
  const navigate = useNavigate();
  const { id: leadId } = useParams<{ id: string }>();
  const { hasRight } = useAuth();
  const { data: lead, loading: leadLoading, refetch } = useFetch<Lead>(`/api/v1/leads/${leadId}`);
  const { data: users } = useFetch<StaffUser[]>('/api/v1/users/lookup');

  const [loading, setLoading] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [cibilStatus, setCibilStatus] = useState('');
  const [cibilScore, setCibilScore] = useState('');
  const [cibilRemarks, setCibilRemarks] = useState('');
  const [rcStatus, setRcStatus] = useState('');
  const [rcRemarks, setRcRemarks] = useState('');
  const [customerType, setCustomerType] = useState('DEALER');
  const [assignedCeiling, setAssignedCeiling] = useState('');
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [automatedCibilInProgress, setAutomatedCibilInProgress] = useState(false);
  const [automatedRcInProgress, setAutomatedRcInProgress] = useState(false);
  const [checkHistory] = useState<CheckLog[]>([]);

  useEffect(() => {
    if (lead) {
      setAssignedToUserId(lead.assignedToUserId ?? '');
      setLeadStatus(lead.leadStatus);
      setCibilStatus(lead.cibilCheckStatus);
      setCibilScore(lead.cibilScorePreview?.toString() ?? '');
      setRcStatus(lead.rcCheckStatus);
    }
  }, [lead]);

  const getLastCheckLog = (checkType: string): CheckLog | undefined => {
    return checkHistory.find(log => log.checkType === checkType);
  };

  const getLastCheckTimestamp = (checkType: string) => {
    const lastCheck = getLastCheckLog(checkType);
    if (!lastCheck) return null;
    const date = new Date(lastCheck.createdAt);
    return {
      date: date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      performer: lastCheck.performedByUserName || lastCheck.performedByUserId,
    };
  };

  if (!lead && leadLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 mx-auto"></div>
          <p className="text-gray-600">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Lead not found</p>
          <button
            onClick={() => navigate('/leads')}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Back to Leads
          </button>
        </div>
      </div>
    );
  }

  const userOptions = users?.map(u => ({ value: u.userId, label: u.fullName || u.userId })) ?? [];

  const handleSaveChanges = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      await apiPut(`/api/v1/leads/${lead.leadId}/assign`, { assigneeUserId: assignedToUserId || null });
      await apiPut(`/api/v1/leads/${lead.leadId}/status`, { status: leadStatus });

      if (cibilStatus !== lead.cibilCheckStatus) {
        await apiPost(`/api/v1/leads/${lead.leadId}/checks`, {
          checkType: 'CIBIL',
          status: cibilStatus,
          score: cibilScore ? parseInt(cibilScore) : null,
          remarks: cibilRemarks,
        });
      }

      if (rcStatus !== lead.rcCheckStatus) {
        await apiPost(`/api/v1/leads/${lead.leadId}/checks`, {
          checkType: 'RC',
          status: rcStatus,
          remarks: rcRemarks,
        });
      }

      refetch();
      alert('Changes saved successfully.');
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateAutomatedCheck = async (checkType: 'CIBIL' | 'RC') => {
    if (!hasRight('leads.edit')) return;

    if (checkType === 'CIBIL') {
      setAutomatedCibilInProgress(true);
    } else {
      setAutomatedRcInProgress(true);
    }

    try {
      await apiPost(`/api/v1/leads/${lead.leadId}/checks/initiate-automated`, {
        checkType: checkType,
      });
      alert(`Automated ${checkType} check initiated. Processing in background...`);
      setTimeout(() => refetch(), 2000);
    } catch (err) {
      console.error(`Failed to initiate ${checkType} check:`, err);
      alert(`Failed to initiate ${checkType} check. Please try again.`);
    } finally {
      if (checkType === 'CIBIL') {
        setAutomatedCibilInProgress(false);
      } else {
        setAutomatedRcInProgress(false);
      }
    }
  };

  const handleConvert = async () => {
    if (!assignedCeiling) {
      alert('Please enter a sub-limit ceiling');
      return;
    }
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
      console.error('Failed to convert lead:', err);
      alert('Failed to convert lead. Please try again.');
      setShowConvertConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/leads')}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1"
            >
              ← Back to Leads
            </button>
          </div>
          <div className="flex gap-2">
            {!lead.convertedCustomerId && hasRight('leads.edit') && (
              <>
                <button
                  onClick={handleSaveChanges}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowConvertConfirm(true)}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Convert to Customer →
                </button>
              </>
            )}
            {lead.convertedCustomerId && (
              <a
                href={`/customers/${lead.convertedCustomerId}`}
                className="px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium hover:bg-green-100"
              >
                ✓ Converted to Customer
              </a>
            )}
          </div>
        </div>

        {/* Title and Status Pills */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.applicantName || 'Unknown Applicant'}</h1>
            <p className="text-gray-600 text-sm mt-1">Lead ID: {lead.leadId}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className={`border rounded-lg p-3 text-center ${getStatusColor(lead.cibilCheckStatus)}`}>
              <div className="text-2xl font-bold">{getStatusIcon(lead.cibilCheckStatus)}</div>
              <p className="text-xs font-semibold mt-1">CIBIL</p>
            </div>
            <div className={`border rounded-lg p-3 text-center ${getStatusColor(lead.rcCheckStatus)}`}>
              <div className="text-2xl font-bold">{getStatusIcon(lead.rcCheckStatus)}</div>
              <p className="text-xs font-semibold mt-1">RC</p>
            </div>
            <div className={`border rounded-lg p-3 text-center ${getStatusColor(lead.leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}`}>
              <div className="text-2xl font-bold">{getStatusIcon(lead.leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}</div>
              <p className="text-xs font-semibold mt-1">Status</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 flex-1 min-h-0 overflow-hidden">

        {/* Left Column: Assignment & Status */}
        <div className="space-y-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Lead Assignment</h3>
            </div>
            <div className="p-4 space-y-3">
              <FormField
                label="Assign to Team Member"
                value={assignedToUserId}
                onChange={setAssignedToUserId}
                options={userOptions}
                disabled={!hasRight('leads.edit')}
              />
              {lead.assignedToUserName && (
                <p className="text-xs text-gray-600">Currently: <span className="font-medium">{lead.assignedToUserName}</span></p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Lead Status</h3>
            </div>
            <div className="p-4">
              <FormField
                label="Lifecycle Status"
                value={leadStatus}
                onChange={setLeadStatus}
                options={LEAD_STATUSES}
                disabled={!hasRight('leads.edit') || !!lead.convertedCustomerId}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Lead Info</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div>
                <p className="text-gray-600">Source</p>
                <p className="font-medium text-gray-900">{lead.leadSource}</p>
              </div>
              <div>
                <p className="text-gray-600">Phone</p>
                <p className="font-medium text-gray-900">{lead.whatsappPhoneNumber}</p>
              </div>
              {lead.requestedLoanAmount && (
                <div>
                  <p className="text-gray-600">Loan Amount</p>
                  <p className="font-medium text-gray-900">₹{lead.requestedLoanAmount.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: Verifications */}
        <div className="space-y-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">CIBIL Check</h3>
              <span className={`text-xs font-medium px-2 py-1 rounded border ${getStatusColor(lead.cibilCheckStatus)}`}>
                {lead.cibilCheckStatus}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {getLastCheckTimestamp('CIBIL') && (
                <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700">
                  <p className="font-medium">Last: {getLastCheckTimestamp('CIBIL')?.date} at {getLastCheckTimestamp('CIBIL')?.time}</p>
                  <p className="text-xs">By: {getLastCheckTimestamp('CIBIL')?.performer}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  label="Status"
                  value={cibilStatus}
                  onChange={setCibilStatus}
                  options={CHECK_STATUSES}
                  disabled={!hasRight('leads.edit') || automatedCibilInProgress}
                />
                <FormField
                  label="Score"
                  value={cibilScore}
                  onChange={setCibilScore}
                  type="number"
                  placeholder="750"
                  disabled={!hasRight('leads.edit') || automatedCibilInProgress}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={cibilRemarks}
                  onChange={(e) => setCibilRemarks(e.target.value)}
                  disabled={!hasRight('leads.edit') || automatedCibilInProgress}
                  placeholder="Notes..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              {hasRight('leads.edit') && (
                <button
                  onClick={() => handleInitiateAutomatedCheck('CIBIL')}
                  disabled={automatedCibilInProgress}
                  className="w-full px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {automatedCibilInProgress ? '⏳ Processing...' : '🔄 Automated Check'}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900">RC Check</h3>
              <span className={`text-xs font-medium px-2 py-1 rounded border ${getStatusColor(lead.rcCheckStatus)}`}>
                {lead.rcCheckStatus}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {getLastCheckTimestamp('RC') && (
                <div className="bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs text-blue-700">
                  <p className="font-medium">Last: {getLastCheckTimestamp('RC')?.date} at {getLastCheckTimestamp('RC')?.time}</p>
                  <p className="text-xs">By: {getLastCheckTimestamp('RC')?.performer}</p>
                </div>
              )}
              <FormField
                label="Status"
                value={rcStatus}
                onChange={setRcStatus}
                options={CHECK_STATUSES}
                disabled={!hasRight('leads.edit') || automatedRcInProgress}
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={rcRemarks}
                  onChange={(e) => setRcRemarks(e.target.value)}
                  disabled={!hasRight('leads.edit') || automatedRcInProgress}
                  placeholder="Notes..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              {hasRight('leads.edit') && (
                <button
                  onClick={() => handleInitiateAutomatedCheck('RC')}
                  disabled={automatedRcInProgress}
                  className="w-full px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {automatedRcInProgress ? '⏳ Processing...' : '🔄 Automated Check'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Comments */}
        <div className="overflow-hidden">
          <CommentsPanel
            basePath={`/api/v1/leads/${lead.leadId}/comments`}
            canAdd={hasRight('leads.edit')}
          />
        </div>
      </div>

      {/* Convert to Customer Modal */}
      {showConvertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Convert to Customer</h2>
              <button
                onClick={() => setShowConvertConfirm(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
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
                placeholder="e.g. 500000"
              />
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowConvertConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvert}
                  disabled={loading || !assignedCeiling}
                  className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Converting...' : 'Convert'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

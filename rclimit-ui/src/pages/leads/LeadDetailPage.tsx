import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
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
  const isCibilPassed = cibilStatus === 'PASSED';
  const isRcPassed = rcStatus === 'PASSED';
  const isQualified = leadStatus === 'QUALIFIED';
  const canConvert = isCibilPassed && isRcPassed && isQualified && !lead.convertedCustomerId;

  const handleSaveChanges = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      await apiPut(`/api/v1/leads/${lead.leadId}/assign`, { assigneeUserId: assignedToUserId || null });
      await apiPut(`/api/v1/leads/${lead.leadId}/status`, { status: leadStatus });

      // Save CIBIL check if status changed
      if (cibilStatus !== lead.cibilCheckStatus) {
        await apiPost(`/api/v1/leads/${lead.leadId}/checks`, {
          checkType: 'CIBIL',
          status: cibilStatus,
          score: cibilScore ? parseInt(cibilScore) : null,
          remarks: cibilRemarks,
        });
      }

      // Save RC check if status changed
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
      // Initiate automated check - backend will process in background
      await apiPost(`/api/v1/leads/${lead.leadId}/checks/initiate-automated`, {
        checkType: checkType,
      });
      alert(`Automated ${checkType} check initiated. Processing in background...`);
      // Optionally refetch after a delay to show updated status
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 mb-4 text-sm">
            <button
              onClick={() => navigate('/leads')}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              ← Back to Leads
            </button>
          </div>

          {/* Title Section */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{lead.applicantName || 'Unknown Applicant'}</h1>
              <p className="text-gray-600 mt-1">Lead ID: {lead.leadId}</p>
            </div>
            {lead.convertedCustomerId && (
              <a
                href={`/customers/${lead.convertedCustomerId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium hover:bg-green-100"
              >
                ✓ Converted to Customer
              </a>
            )}
          </div>

          {/* Qualification Pipeline */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className={`border rounded-lg p-4 ${getStatusColor(cibilStatus)}`}>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white bg-gray-800">
                    {getStatusIcon(cibilStatus)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">CIBIL Check</p>
                  <p className="text-lg font-semibold">{cibilStatus}</p>
                </div>
              </div>
            </div>

            <div className={`border rounded-lg p-4 ${getStatusColor(rcStatus)}`}>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white bg-gray-800">
                    {getStatusIcon(rcStatus)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">RC Check</p>
                  <p className="text-lg font-semibold">{rcStatus}</p>
                </div>
              </div>
            </div>

            <div className={`border rounded-lg p-4 ${getStatusColor(leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}`}>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white bg-gray-800">
                    {getStatusIcon(leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Lead Status</p>
                  <p className="text-lg font-semibold">{leadStatus}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Assignment & Status */}
          <div className="lg:col-span-1 space-y-6">

            {/* Lead Assignment Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Lead Assignment</h3>
              </div>
              <div className="p-6 space-y-4">
                <FormField
                  label="Assign to Team Member"
                  value={assignedToUserId}
                  onChange={setAssignedToUserId}
                  options={userOptions}
                  disabled={!hasRight('leads.edit')}
                />
                {lead.assignedToUserName && (
                  <p className="text-xs text-gray-600">Currently assigned to: <span className="font-medium">{lead.assignedToUserName}</span></p>
                )}
              </div>
            </div>

            {/* Lead Status Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Lead Status</h3>
              </div>
              <div className="p-6 space-y-4">
                <FormField
                  label="Lifecycle Status"
                  value={leadStatus}
                  onChange={setLeadStatus}
                  options={LEAD_STATUSES}
                  disabled={!hasRight('leads.edit') || !!lead.convertedCustomerId}
                />
              </div>
            </div>

            {/* Lead Info Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Lead Information</h3>
              </div>
              <div className="p-6 space-y-4 text-sm">
                <div>
                  <p className="text-gray-600">Source</p>
                  <p className="font-medium text-gray-900">{lead.leadSource}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone</p>
                  <p className="font-medium text-gray-900">{lead.whatsappPhoneNumber}</p>
                </div>
                {lead.contactPhone && (
                  <div>
                    <p className="text-gray-600">Alternate Phone</p>
                    <p className="font-medium text-gray-900">{lead.contactPhone}</p>
                  </div>
                )}
                {lead.requestedLoanAmount && (
                  <div>
                    <p className="text-gray-600">Requested Loan Amount</p>
                    <p className="font-medium text-gray-900">₹{lead.requestedLoanAmount.toLocaleString()}</p>
                  </div>
                )}
                {lead.vehicleRegistrationNumber && (
                  <div>
                    <p className="text-gray-600">Vehicle Registration</p>
                    <p className="font-medium text-gray-900">{lead.vehicleRegistrationNumber}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Verification Checks */}
          <div className="lg:col-span-2 space-y-6">

            {/* CIBIL Check Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900">CIBIL Verification</h3>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getStatusColor(cibilStatus)}`}>
                  {cibilStatus}
                </span>
              </div>
              <div className="p-6 space-y-4">
                {/* Last Update Info */}
                {getLastCheckTimestamp('CIBIL') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                    <p className="font-medium">Last checked: {getLastCheckTimestamp('CIBIL')?.date} at {getLastCheckTimestamp('CIBIL')?.time}</p>
                    <p>By: {getLastCheckTimestamp('CIBIL')?.performer}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Status"
                    value={cibilStatus}
                    onChange={setCibilStatus}
                    options={CHECK_STATUSES}
                    disabled={!hasRight('leads.edit') || automatedCibilInProgress}
                  />
                  <FormField
                    label="CIBIL Score"
                    value={cibilScore}
                    onChange={setCibilScore}
                    type="number"
                    placeholder="e.g. 750"
                    disabled={!hasRight('leads.edit') || automatedCibilInProgress}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    value={cibilRemarks}
                    onChange={(e) => setCibilRemarks(e.target.value)}
                    disabled={!hasRight('leads.edit') || automatedCibilInProgress}
                    placeholder="Add notes about credit history, scoring factors, etc..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                {hasRight('leads.edit') && (
                  <button
                    onClick={() => handleInitiateAutomatedCheck('CIBIL')}
                    disabled={automatedCibilInProgress}
                    className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {automatedCibilInProgress ? '⏳ Processing...' : '🔄 Initiate Automated CIBIL Check'}
                  </button>
                )}
              </div>
            </div>

            {/* RC Check Card */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900">RC Verification</h3>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getStatusColor(rcStatus)}`}>
                  {rcStatus}
                </span>
              </div>
              <div className="p-6 space-y-4">
                {/* Last Update Info */}
                {getLastCheckTimestamp('RC') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                    <p className="font-medium">Last checked: {getLastCheckTimestamp('RC')?.date} at {getLastCheckTimestamp('RC')?.time}</p>
                    <p>By: {getLastCheckTimestamp('RC')?.performer}</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    value={rcRemarks}
                    onChange={(e) => setRcRemarks(e.target.value)}
                    disabled={!hasRight('leads.edit') || automatedRcInProgress}
                    placeholder="Add notes about vehicle registration, hypothecation status, etc..."
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>
                {hasRight('leads.edit') && (
                  <button
                    onClick={() => handleInitiateAutomatedCheck('RC')}
                    disabled={automatedRcInProgress}
                    className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {automatedRcInProgress ? '⏳ Processing...' : '🔄 Initiate Automated RC Check'}
                  </button>
                )}
              </div>
            </div>

            {/* Conversion Section */}
            {!lead.convertedCustomerId && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-900">Convert to Customer</h3>
                </div>
                <div className="p-6">
                  {canConvert ? (
                    <div className="space-y-4">
                      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        ✓ This lead is ready for conversion. All checks passed and status is qualified.
                      </p>
                      <button
                        onClick={() => setShowConvertConfirm(true)}
                        disabled={loading}
                        className="w-full px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Proceed with Conversion →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ This lead is not ready for conversion yet.
                      </p>
                      <ul className="space-y-2 text-sm text-gray-600">
                        <li className={`flex items-center gap-2 ${isCibilPassed ? 'text-green-600' : 'text-red-600'}`}>
                          {isCibilPassed ? '✓' : '✗'} CIBIL Check: {cibilStatus}
                        </li>
                        <li className={`flex items-center gap-2 ${isRcPassed ? 'text-green-600' : 'text-amber-600'}`}>
                          {isRcPassed ? '✓' : '✗'} RC Check: {rcStatus}
                        </li>
                        <li className={`flex items-center gap-2 ${isQualified ? 'text-green-600' : 'text-gray-600'}`}>
                          {isQualified ? '✓' : '○'} Lead Status: {leadStatus}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Changes Footer */}
      {!lead.convertedCustomerId && hasRight('leads.edit') && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">Changes to assignment, status, and verification checks will be saved</p>
            <button
              onClick={handleSaveChanges}
              disabled={loading}
              className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Conversion Confirmation Modal */}
      {showConvertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Convert to Customer</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Fill in the details to complete the conversion.</p>
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
                  {loading ? 'Converting...' : 'Confirm Conversion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

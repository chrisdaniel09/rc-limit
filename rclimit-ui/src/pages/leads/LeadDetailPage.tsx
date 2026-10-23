import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPut, apiPost, apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
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
  convertedAt: string | null;
  convertedCustomerName: string | null;
  isLocked: boolean;
  createdAt: string;
}

interface CustomerMatch {
  customerId: string;
  legalName: string;
  phoneNumber: string | null;
  matchedOn: string;
  matchReasons: string[];
  vehicleCount: number;
  previousLeadCount: number;
  lastLeadAt: string | null;
}

interface CustomerOption {
  customerId: string;
  legalName: string;
  phoneNumber: string | null;
  customerType: string;
}

const REASON_STYLES: Record<string, string> = {
  PHONE: 'bg-blue-100 text-blue-800',
  VEHICLE: 'bg-green-100 text-green-800',
  NAME: 'bg-amber-100 text-amber-800',
};

interface VehiclePreview {
  registrationNumber: string;
  status: string;
  currentOwnerName: string | null;
}

interface ConversionPreview {
  customerMatches: CustomerMatch[];
  vehicle: VehiclePreview;
}

interface StaffUser {
  userId: string;
  fullName: string | null;
}

interface Comment {
  commentId: string;
  commentText: string;
  createdByUserId: string;
  createdByUserName: string | null;
  createdAt: string;
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
  const { data: comments = [] } = useFetch<Comment[]>(`/api/v1/leads/${leadId}/comments`);

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
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [automatedCibilInProgress, setAutomatedCibilInProgress] = useState(false);
  const [automatedRcInProgress, setAutomatedRcInProgress] = useState(false);
  const [checkHistory] = useState<CheckLog[]>([]);

  // Conversion dialog state
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [conversionMode, setConversionMode] = useState<'new' | 'existing'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [confirmVehicleTransfer, setConfirmVehicleTransfer] = useState(false);
  const [conversionPreview, setConversionPreview] = useState<ConversionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerOption[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const latestCustomerSearch = useRef(0);

  // Search all customers (for matches the automatic suggestions missed). Debounced, and only the latest search applies.
  useEffect(() => {
    if (!showConvertDialog || conversionMode !== 'existing') return;

    const term = customerSearch.trim();
    const requestId = ++latestCustomerSearch.current;
    if (term.length < 2) {
      setSearchResults([]);
      setSearchingCustomers(false);
      return;
    }

    setSearchingCustomers(true);
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ search: term, pageSize: '10', sortBy: 'legalName' });
        const response = await apiGet<{ data: CustomerOption[] }>(`/api/v1/customers?${query}`);
        if (requestId === latestCustomerSearch.current) setSearchResults(response.data);
      } catch {
        if (requestId === latestCustomerSearch.current) setSearchResults([]);
      } finally {
        if (requestId === latestCustomerSearch.current) setSearchingCustomers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch, showConvertDialog, conversionMode]);

  // Sync form state when a freshly fetched lead arrives (adjusting state during render, not in an effect)
  const [syncedLead, setSyncedLead] = useState<Lead | null>(null);
  if (lead && lead !== syncedLead) {
    setSyncedLead(lead);
    setAssignedToUserId(lead.assignedToUserId ?? '');
    setLeadStatus(lead.leadStatus);
    setCibilStatus(lead.cibilCheckStatus);
    setCibilScore(lead.cibilScorePreview?.toString() ?? '');
    setRcStatus(lead.rcCheckStatus);
  }

  const canEdit = hasRight('leads.edit') && !lead?.isLocked;

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

  const fetchConversionPreview = async (customerId?: string) => {
    setLoadingPreview(true);
    try {
      const url = `/api/v1/leads/${leadId}/conversion-preview${customerId ? `?customerId=${customerId}` : ''}`;
      const response = await apiGet<{ data: ConversionPreview }>(url);
      setConversionPreview(response.data);
    } catch (err) {
      console.error('Failed to fetch conversion preview:', err);
      alert('Failed to load conversion preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenConvertDialog = async () => {
    setShowConvertDialog(true);
    setConversionMode('new');
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setSearchResults([]);
    setConfirmVehicleTransfer(false);
    await fetchConversionPreview();
  };

  const handleSelectExistingCustomer = async (customer: Pick<CustomerOption, 'customerId' | 'legalName' | 'phoneNumber'>) => {
    setSelectedCustomerId(customer.customerId);
    setSelectedCustomer({ ...customer, customerType: '' });
    setConfirmVehicleTransfer(false);
    await fetchConversionPreview(customer.customerId);
  };

  const handleConvert = async () => {
    if (conversionMode === 'new') {
      if (!customerType || !assignedCeiling) {
        alert('Please enter customer type and sub-limit ceiling');
        return;
      }
    } else {
      if (!selectedCustomerId) {
        alert('Please select a customer');
        return;
      }
      if (conversionPreview?.vehicle.status === 'OWNED_BY_OTHER' && !confirmVehicleTransfer) {
        alert('Please confirm vehicle transfer');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        maxPendingRcAllowed: 5,
      };

      if (conversionMode === 'new') {
        payload.customerType = customerType;
        payload.assignedCeiling = parseFloat(assignedCeiling);
      } else {
        payload.existingCustomerId = selectedCustomerId;
        payload.confirmVehicleTransfer = confirmVehicleTransfer;
      }

      const response = await apiPost<any>(`/api/v1/leads/${leadId}/convert`, payload);
      navigate(`/customers/${response.data.customerId}`);
    } catch (err) {
      console.error('Failed to convert lead:', err);
      // The server's message carries the business rule (for example, an open loan blocks the transfer).
      alert(err instanceof Error ? err.message : 'Failed to convert lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!canEdit) return;
    setLoading(true);
    try {
      await apiPut(`/api/v1/leads/${lead!.leadId}/assign`, { assigneeUserId: assignedToUserId || null });
      await apiPut(`/api/v1/leads/${lead!.leadId}/status`, { status: leadStatus });

      if (cibilStatus !== lead!.cibilCheckStatus) {
        await apiPost(`/api/v1/leads/${lead!.leadId}/checks`, {
          checkType: 'CIBIL',
          status: cibilStatus,
          score: cibilScore ? parseInt(cibilScore) : null,
          remarks: cibilRemarks,
        });
      }

      if (rcStatus !== lead!.rcCheckStatus) {
        await apiPost(`/api/v1/leads/${lead!.leadId}/checks`, {
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
    if (!canEdit) return;

    if (checkType === 'CIBIL') {
      setAutomatedCibilInProgress(true);
    } else {
      setAutomatedRcInProgress(true);
    }

    try {
      await apiPost(`/api/v1/leads/${lead!.leadId}/checks/initiate-automated`, {
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
  const lastComment = comments && comments.length > 0 ? comments[0] : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-gray-50 overflow-hidden">
      {/* Locked Banner */}
      {lead.isLocked && lead.convertedCustomerId && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span className="text-sm text-amber-900">
              This lead has been converted to customer <span className="font-semibold">{lead.convertedCustomerName}</span> on {new Date(lead.convertedAt!).toLocaleDateString('en-IN')}
            </span>
          </div>
          <Link
            to={`/customers/${lead.convertedCustomerId}`}
            className="text-amber-700 hover:text-amber-900 font-medium text-sm underline"
          >
            View Customer →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => navigate('/leads')}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-sm mb-2 flex items-center gap-1"
            >
              ← Back to Leads
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{lead.applicantName || 'Unknown Applicant'}</h1>
            <p className="text-gray-600 mt-1">Lead ID: {lead.leadId}</p>
          </div>
          <div className="flex gap-2">
            {lead.convertedCustomerId && (
              <Link
                to={`/customers/${lead.convertedCustomerId}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium hover:bg-green-100"
              >
                ✓ Converted to Customer
              </Link>
            )}
            {!lead.convertedCustomerId && hasRight('leads.edit') && (
              <button
                onClick={handleOpenConvertDialog}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
              >
                Convert to Customer →
              </button>
            )}
          </div>
        </div>

        {/* Qualification Pipeline */}
        <div className="grid grid-cols-3 gap-4">
          <div className={`border rounded-lg p-4 ${getStatusColor(lead.cibilCheckStatus)}`}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white bg-gray-800">
                  {getStatusIcon(lead.cibilCheckStatus)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">CIBIL Check</p>
                <p className="text-lg font-semibold">{lead.cibilCheckStatus}</p>
              </div>
            </div>
          </div>

          <div className={`border rounded-lg p-4 ${getStatusColor(lead.rcCheckStatus)}`}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white bg-gray-800">
                  {getStatusIcon(lead.rcCheckStatus)}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">RC Check</p>
                <p className="text-lg font-semibold">{lead.rcCheckStatus}</p>
              </div>
            </div>
          </div>

          <div className={`border rounded-lg p-4 ${getStatusColor(lead.leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}`}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white bg-gray-800">
                  {getStatusIcon(lead.leadStatus === 'QUALIFIED' ? 'PASSED' : 'NOT_STARTED')}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">Lead Status</p>
                <p className="text-lg font-semibold">{lead.leadStatus}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

          {/* Last Comment Preview */}
          {lastComment && (
            <div className="border-l-4 border-indigo-500 bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-gray-900">Latest Comment</p>
                <button
                  onClick={() => setShowCommentsModal(true)}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  View All Comments →
                </button>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {lastComment.createdByUserName} • {new Date(lastComment.createdAt).toLocaleDateString('en-IN')}
              </p>
              <p className="text-sm text-gray-700 line-clamp-2">{lastComment.commentText}</p>
            </div>
          )}

          {!lastComment && (
            <div className="border border-dashed border-gray-300 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">No comments yet</p>
                <button
                  onClick={() => setShowCommentsModal(true)}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  Add Comment →
                </button>
              </div>
            </div>
          )}

          {/* 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Left Column: Assignment & Status */}
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Lead Assignment</h3>
                <FormField
                  label="Assign to Team Member"
                  value={assignedToUserId}
                  onChange={setAssignedToUserId}
                  options={userOptions}
                  disabled={!canEdit}
                />
                {lead.assignedToUserName && (
                  <p className="text-xs text-gray-600">Currently assigned to: <span className="font-medium">{lead.assignedToUserName}</span></p>
                )}
              </div>

              <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Lead Status</h3>
                <FormField
                  label="Lifecycle Status"
                  value={leadStatus}
                  onChange={setLeadStatus}
                  options={LEAD_STATUSES}
                  disabled={!canEdit}
                />
              </div>

              <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Lead Info</h3>
                <div className="space-y-3 text-sm">
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
                      <p className="text-gray-600">Requested Loan Amount</p>
                      <p className="font-medium text-gray-900">₹{lead.requestedLoanAmount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Verifications */}
            <div className="space-y-6">
              {/* CIBIL Check Card */}
              <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-semibold text-gray-900">CIBIL Verification</h3>
                  <span className={`text-xs px-2 py-1 rounded font-medium border ${getStatusColor(lead.cibilCheckStatus)}`}>
                    {lead.cibilCheckStatus}
                  </span>
                </div>
                {getLastCheckTimestamp('CIBIL') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                    <p className="font-medium">Last checked: {getLastCheckTimestamp('CIBIL')?.date} at {getLastCheckTimestamp('CIBIL')?.time}</p>
                    <p>By: {getLastCheckTimestamp('CIBIL')?.performer}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    label="Status"
                    value={cibilStatus}
                    onChange={setCibilStatus}
                    options={CHECK_STATUSES}
                    disabled={!canEdit}
                  />
                  <FormField
                    label="Score"
                    value={cibilScore}
                    onChange={setCibilScore}
                    type="number"
                    placeholder="750"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    value={cibilRemarks}
                    onChange={(e) => setCibilRemarks(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Credit history notes..."
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleInitiateAutomatedCheck('CIBIL')}
                    disabled={automatedCibilInProgress}
                    className="w-full px-2 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {automatedCibilInProgress ? '⏳ Processing...' : '🔄 Initiate Automated Check'}
                  </button>
                )}
              </div>

              {/* RC Check Card */}
              <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-sm font-semibold text-gray-900">RC Verification</h3>
                  <span className={`text-xs px-2 py-1 rounded font-medium border ${getStatusColor(lead.rcCheckStatus)}`}>
                    {lead.rcCheckStatus}
                  </span>
                </div>
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
                  disabled={!canEdit}
                />
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea
                    value={rcRemarks}
                    onChange={(e) => setRcRemarks(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Vehicle registration notes..."
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleInitiateAutomatedCheck('RC')}
                    disabled={automatedRcInProgress}
                    className="w-full px-2 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {automatedRcInProgress ? '⏳ Processing...' : '🔄 Initiate Automated Check'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Footer */}
      {canEdit && (
        <div className="border-t border-gray-200 bg-white px-6 py-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">Any changes to assignment, status, and verification checks will be saved</p>
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

      {/* Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Comments & Call Notes</h2>
              <button
                onClick={() => setShowCommentsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CommentsPanel
                basePath={`/api/v1/leads/${lead.leadId}/comments`}
                canAdd={hasRight('leads.edit')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Convert to Customer Modal */}
      {showConvertDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Convert Lead to Customer</h2>
              <button
                onClick={() => setShowConvertDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Select Option</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50" style={{ borderColor: conversionMode === 'new' ? '#4f46e5' : '#d1d5db', backgroundColor: conversionMode === 'new' ? '#eef2ff' : 'transparent' }}>
                    <input
                      type="radio"
                      name="conversionMode"
                      value="new"
                      checked={conversionMode === 'new'}
                      onChange={(e) => {
                        setConversionMode(e.target.value as 'new' | 'existing');
                        setSelectedCustomerId(null);
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Create New Customer</p>
                      <p className="text-xs text-gray-600">Set customer type and sub-limit ceiling</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50" style={{ borderColor: conversionMode === 'existing' ? '#4f46e5' : '#d1d5db', backgroundColor: conversionMode === 'existing' ? '#eef2ff' : 'transparent' }}>
                    <input
                      type="radio"
                      name="conversionMode"
                      value="existing"
                      checked={conversionMode === 'existing'}
                      onChange={(e) => {
                        setConversionMode(e.target.value as 'new' | 'existing');
                        setSelectedCustomerId(null);
                        setSelectedCustomer(null);
                        fetchConversionPreview();
                      }}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="font-medium text-gray-900">Link to Existing Customer</p>
                      <p className="text-xs text-gray-600">Link to a customer by phone or name match</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* New Customer Mode */}
              {conversionMode === 'new' && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                </div>
              )}

              {/* Existing Customer Mode */}
              {conversionMode === 'existing' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">Search all customers</label>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Type at least 2 characters of name or phone"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                    {searchingCustomers && <p className="text-xs text-gray-500">Searching...</p>}
                    {!searchingCustomers && customerSearch.trim().length >= 2 && searchResults.length === 0 && (
                      <p className="text-xs text-gray-600">No customers match &quot;{customerSearch.trim()}&quot;.</p>
                    )}
                    {searchResults.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {searchResults.map((customer) => (
                          <button
                            key={customer.customerId}
                            type="button"
                            onClick={() => handleSelectExistingCustomer(customer)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedCustomerId === customer.customerId
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 bg-white hover:border-indigo-300'
                            }`}
                          >
                            <p className="font-medium text-gray-900">{customer.legalName}</p>
                            <p className="text-xs text-gray-600">{customer.phoneNumber ?? '-'} · {customer.customerType}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedCustomer && (
                      <p className="text-xs text-gray-700">Selected: <span className="font-semibold">{selectedCustomer.legalName}</span></p>
                    )}
                  </div>

                  {loadingPreview && (
                    <div className="text-center py-8">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
                      <p className="text-sm text-gray-600 mt-2">Loading customer matches...</p>
                    </div>
                  )}

                  {!loadingPreview && conversionPreview && (
                    <>
                      {/* Customer Matches */}
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-3">Available Customers</p>
                        {conversionPreview.customerMatches.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {conversionPreview.customerMatches.map((match) => (
                              <button
                                key={match.customerId}
                                onClick={() => handleSelectExistingCustomer(match)}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${
                                  selectedCustomerId === match.customerId
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-200 bg-white hover:border-indigo-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{match.legalName}</p>
                                    <p className="text-xs text-gray-600">{match.phoneNumber}</p>
                                  </div>
                                  <div className="text-right">
                                    <div className="flex flex-wrap justify-end gap-1">
                                      {match.matchReasons.map((reason) => (
                                        <span key={reason} className={`inline-block px-2 py-1 text-xs font-medium rounded ${REASON_STYLES[reason] ?? 'bg-gray-100 text-gray-800'}`}>
                                          {reason}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-4 mt-2 text-xs text-gray-600">
                                  <span>{match.vehicleCount} vehicles</span>
                                  <span>{match.previousLeadCount} previous leads</span>
                                  {match.lastLeadAt && (
                                    <span>Last: {new Date(match.lastLeadAt).toLocaleDateString('en-IN')}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 py-4">No suggested customers. Search above.</p>
                        )}
                      </div>

                      {/* Vehicle Preview */}
                      {selectedCustomerId && conversionPreview.vehicle && (
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-900">Vehicle: {conversionPreview.vehicle.registrationNumber}</h4>
                            <span className={`text-xs font-medium px-2 py-1 rounded ${
                              conversionPreview.vehicle.status === 'NEW' ? 'bg-green-100 text-green-800' :
                              conversionPreview.vehicle.status === 'SAME_OWNER' ? 'bg-blue-100 text-blue-800' :
                              conversionPreview.vehicle.status === 'OWNED_BY_OTHER' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {conversionPreview.vehicle.status}
                            </span>
                          </div>

                          {conversionPreview.vehicle.status === 'NEW' && (
                            <p className="text-sm text-gray-700">This vehicle will be registered to the selected customer.</p>
                          )}

                          {conversionPreview.vehicle.status === 'SAME_OWNER' && (
                            <p className="text-sm text-gray-700">This vehicle is already owned by the selected customer.</p>
                          )}

                          {conversionPreview.vehicle.status === 'OWNED_BY_OTHER' && (
                            <div className="space-y-3">
                              <p className="text-sm text-gray-700">
                                This vehicle is currently owned by <span className="font-semibold">{conversionPreview.vehicle.currentOwnerName}</span>.
                              </p>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={confirmVehicleTransfer}
                                  onChange={(e) => setConfirmVehicleTransfer(e.target.checked)}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm text-gray-700">
                                  I confirm transferring this vehicle to the selected customer
                                </span>
                              </label>
                            </div>
                          )}

                          {conversionPreview.vehicle.status === 'BLOCKED' && (
                            <div className="bg-red-100 border border-red-300 rounded p-3">
                              <p className="text-sm text-red-800 font-medium">⚠️ Vehicle Transfer Blocked</p>
                              <p className="text-sm text-red-700 mt-1">This vehicle has an open loan. Transfer is not permitted.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowConvertDialog(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={
                  loading ||
                  loadingPreview ||
                  (conversionMode === 'new' && (!customerType || !assignedCeiling)) ||
                  (conversionMode === 'existing' && (!selectedCustomerId || (conversionPreview?.vehicle.status === 'OWNED_BY_OTHER' && !confirmVehicleTransfer) || conversionPreview?.vehicle.status === 'BLOCKED'))
                }
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

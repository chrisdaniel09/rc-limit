import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPut, apiPost } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
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

  const handleAssign = async () => {
    if (!hasRight('leads.edit')) return;
    setLoading(true);
    try {
      await apiPut(`/api/v1/leads/${lead.leadId}/assign`, { assigneeUserId: assignedToUserId || null });
      onLeadUpdated();
    } catch (err) {
      alert('Failed to assign lead');
    } finally {
      setLoading(false);
    }
  };

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

  const isQualifiedAndAllChecksPassed =
    leadStatus === 'QUALIFIED' &&
    cibilStatus === 'PASSED' &&
    rcStatus === 'PASSED';

  const isAlreadyConverted = !!lead.convertedCustomerId;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Lead: ${lead.applicantName || 'Unknown'}`}>
      <div className="space-y-6">
        {/* Warning Banner */}
        {!isQualifiedAndAllChecksPassed && !isAlreadyConverted && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
            ⚠️ This lead is not fully qualified for conversion. Status must be QUALIFIED and both CIBIL and RC checks must be PASSED.
          </div>
        )}

        {/* Converted Banner */}
        {isAlreadyConverted && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            ✓ This lead has been converted to customer. <a href={`/customers/${lead.convertedCustomerId}`} className="underline font-semibold">View customer</a>
          </div>
        )}

        {/* Assignment Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Assignment</h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <FormField
                label="Assign to"
                value={assignedToUserId}
                onChange={setAssignedToUserId}
                options={userOptions}
                disabled={!hasRight('leads.edit')}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAssign}
                disabled={loading || !hasRight('leads.edit')}
                className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Status Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">Lead Status</h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <FormField
                label="Status"
                value={leadStatus}
                onChange={setLeadStatus}
                options={LEAD_STATUSES}
                disabled={!hasRight('leads.edit') || isAlreadyConverted}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleStatusChange}
                disabled={loading || !hasRight('leads.edit') || isAlreadyConverted}
                className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* CIBIL Check Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">CIBIL Check</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <FormField
                  label="Status"
                  value={cibilStatus}
                  onChange={setCibilStatus}
                  options={CHECK_STATUSES}
                  disabled={!hasRight('leads.edit')}
                />
              </div>
              <div className="flex-1">
                <FormField
                  label="Score"
                  value={cibilScore}
                  onChange={setCibilScore}
                  type="number"
                  placeholder="e.g. 750"
                  disabled={!hasRight('leads.edit')}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={cibilRemarks}
                onChange={(e) => setCibilRemarks(e.target.value)}
                disabled={!hasRight('leads.edit')}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            <button
              onClick={handleRecordCibilCheck}
              disabled={loading || !hasRight('leads.edit')}
              className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Record CIBIL Check
            </button>
          </div>
        </div>

        {/* RC Check Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-gray-900 mb-3">RC Check</h3>
          <div className="space-y-3">
            <FormField
              label="Status"
              value={rcStatus}
              onChange={setRcStatus}
              options={CHECK_STATUSES}
              disabled={!hasRight('leads.edit')}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={rcRemarks}
                onChange={(e) => setRcRemarks(e.target.value)}
                disabled={!hasRight('leads.edit')}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            <button
              onClick={handleRecordRcCheck}
              disabled={loading || !hasRight('leads.edit')}
              className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Record RC Check
            </button>
          </div>
        </div>

        {/* Convert Section */}
        {!isAlreadyConverted && (
          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Convert to Customer</h3>
            {showConvertConfirm ? (
              <div className="space-y-3">
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
                  required
                  placeholder="e.g. 500000"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleConvert}
                    disabled={loading || !assignedCeiling}
                    className="flex-1 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    Confirm Conversion
                  </button>
                  <button
                    onClick={() => setShowConvertConfirm(false)}
                    className="flex-1 px-3 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConvertConfirm(true)}
                disabled={!hasRight('leads.edit')}
                className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Convert to Customer
              </button>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="border-t pt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

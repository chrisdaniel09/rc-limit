import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPut, apiPost, apiGet } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import FormField from '../../components/FormField';
import CommentsPanel from '../../components/CommentsPanel';
import {
  ACTION_LABELS,
  ACTION_TAKES_SCORE,
  AUTOMATED_FIELDS,
  OUTCOME_OPTIONS,
  ROLE_OPTIONS,
  type ActionRun,
  type ProductAction,
  type ProductField,
  type ProductType,
} from './productTypes';

interface Lead {
  leadId: string;
  applicantName: string;
  whatsappPhoneNumber: string;
  contactPhone: string | null;
  leadSource: string;
  referredByUserId: string | null;
  referredByUserName: string | null;
  leadStatus: string;
  notes: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  convertedCustomerName: string | null;
  isLocked: boolean;
  createdAt: string;
  productTypeCode: string;
  referenceNumber: string | null;
  productDetails: Record<string, string | number | null>;
  fieldSchema: ProductField[];
  configuredActions: ProductAction[];
  actionHistory: ActionRun[];
}

interface ActionForm {
  outcome: string;
  score: string;
  remarks: string;
}

type ActionMode = 'manual' | 'automated' | 'history';

const ACTION_MODE_LABELS: Record<ActionMode, string> = {
  manual: 'Manual',
  automated: 'Automated',
  history: 'History',
};

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

// LEAD keeps the lead's value. VEHICLE keeps the value the vehicle already has.
type ConflictChoice = 'LEAD' | 'VEHICLE';

interface VehicleConflict {
  role: string;
  field: string;
  currentValue: string | null;
  leadValue: string | null;
}

// The vehicle is null when the lead's financial requirement has no vehicle.
interface VehiclePreview {
  registrationNumber: string;
  status: string;
  currentOwnerName: string | null;
  conflicts: VehicleConflict[];
}

interface ConversionPreview {
  customerMatches: CustomerMatch[];
  vehicle: VehiclePreview | null;
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

const LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'REJECTED', label: 'Rejected' },
];

const LEAD_SOURCE_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  CALL_IN: 'Call-in',
  WALK_IN: 'Walk-in',
  REFERRAL: 'Referral',
  WEBSITE: 'Website',
  OTHER: 'Other',
};

const TONE_CLASSES = {
  success: { card: 'border-green-200 bg-green-50', text: 'text-green-800', icon: 'bg-green-600', glyph: '✓' },
  danger: { card: 'border-red-200 bg-red-50', text: 'text-red-800', icon: 'bg-red-600', glyph: '✗' },
  warning: { card: 'border-amber-200 bg-amber-50', text: 'text-amber-800', icon: 'bg-amber-500', glyph: '⏱' },
  info: { card: 'border-indigo-200 bg-indigo-50', text: 'text-indigo-800', icon: 'bg-indigo-600', glyph: '•' },
  neutral: { card: 'border-gray-200 bg-white', text: 'text-gray-700', icon: 'bg-gray-400', glyph: '○' },
} as const;

type Tone = keyof typeof TONE_CLASSES;

const getCheckTone = (status: string): Tone => {
  if (status === 'PASSED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'IN_PROGRESS') return 'warning';
  return 'neutral';
};

const getLeadStatusTone = (status: string): Tone => {
  if (status === 'QUALIFIED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'IN_PROGRESS') return 'warning';
  return 'info';
};

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </header>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const styles = TONE_CLASSES[tone];
  return (
    <div className={`flex items-center justify-between rounded-xl border px-5 py-4 ${styles.card}`}>
      <div>
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <p className={`mt-1 text-base font-semibold ${styles.text}`}>{value.replace(/_/g, ' ')}</p>
      </div>
      <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${styles.icon}`}>
        {styles.glyph}
      </span>
    </div>
  );
}

// An action tile. The "Choose an action" button sits beside the status icon. The menu opens below it with Manual, Automated or History for this action only.
function ActionTile({ label, value, tone, onChoose }: {
  label: string;
  value: string;
  tone: Tone;
  onChoose: (mode: ActionMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const styles = TONE_CLASSES[tone];

  // Close the menu on a press outside it.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <div className={`rounded-xl border px-5 py-4 ${styles.card}`}>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className={`text-base font-semibold ${styles.text}`}>{value.replace(/_/g, ' ')}</p>
        <div className="flex items-center gap-3">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Choose an action ▾
            </button>
            {open && (
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {(["manual", "automated", "history"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setOpen(false); onChoose(mode); }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {ACTION_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${styles.icon}`}>
            {styles.glyph}
          </span>
        </div>
      </div>
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={3}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

export default function LeadDetailPage() {
  const navigate = useNavigate();
  const { id: leadId } = useParams<{ id: string }>();
  const { hasRight } = useAuth();
  const { data: lead, loading: leadLoading, refetch } = useFetch<Lead>(`/api/v1/leads/${leadId}`);
  const { data: users } = useFetch<StaffUser[]>('/api/v1/users/lookup');
  const { data: comments = [] } = useFetch<Comment[]>(`/api/v1/leads/${leadId}/comments`);
  const { data: productTypes } = useFetch<ProductType[]>('/api/v1/lead-product-types');

  const [loading, setLoading] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [actionPanel, setActionPanel] = useState<{ mode: ActionMode; actionCode: string } | null>(null);
  const [manualForm, setManualForm] = useState<ActionForm>({ outcome: '', score: '', remarks: '' });
  const [automatedForm, setAutomatedForm] = useState<Record<string, string>>({});
  const [runningActions, setRunningActions] = useState(false);
  const [customerType, setCustomerType] = useState('DEALER');
  const [assignedCeiling, setAssignedCeiling] = useState('');
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Conversion dialog state
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [conversionMode, setConversionMode] = useState<'new' | 'existing'>('new');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [confirmVehicleTransfer, setConfirmVehicleTransfer] = useState(false);
  const [conflictDecisions, setConflictDecisions] = useState<Record<string, ConflictChoice>>({});
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
  }

  const canEdit = hasRight('leads.edit') && !lead?.isLocked;

  // The most recent run of an action, or none if it has not been run.
  const latestRun = (actionCode: string): ActionRun | undefined =>
    lead?.actionHistory.find((run) => run.actionCode === actionCode);

  const latestOutcome = (actionCode: string): string | null => {
    const run = latestRun(actionCode);
    return run?.response?.outcome ?? null;
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
    setConflictDecisions({});
    await fetchConversionPreview();
  };

  const handleSelectExistingCustomer = async (customer: Pick<CustomerOption, 'customerId' | 'legalName' | 'phoneNumber'>) => {
    setSelectedCustomerId(customer.customerId);
    setSelectedCustomer({ ...customer, customerType: '' });
    setConfirmVehicleTransfer(false);
    await fetchConversionPreview(customer.customerId);
  };

  // Every conflict on the vehicle needs an explicit choice. Converting with an undecided conflict is refused.
  const undecidedConflicts = (conversionPreview?.vehicle?.conflicts ?? []).filter((c) => !conflictDecisions[c.role]);

  const handleConvert = async () => {
    if (undecidedConflicts.length > 0) {
      alert(`Choose which value to keep for: ${undecidedConflicts.map((c) => c.field).join(', ')}.`);
      return;
    }

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
      if (conversionPreview?.vehicle?.status === 'OWNED_BY_OTHER' && !confirmVehicleTransfer) {
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

      if (conversionPreview?.vehicle) payload.conflictDecisions = conflictDecisions;

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
      refetch();
      alert('Changes saved successfully.');
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openActionPanel = (mode: ActionMode, actionCode: string) => {
    setManualForm({ outcome: '', score: '', remarks: '' });
    setAutomatedForm({
      pan: '',
      mobile: lead?.whatsappPhoneNumber ?? '',
      fullName: lead?.applicantName ?? '',
      registration: lead?.referenceNumber ?? '',
    });
    setActionPanel({ mode, actionCode });
  };

  // The automated check is not connected yet. The form checks the required fields and says so, rather than sending anything.
  const submitAutomatedCheck = () => {
    if (!actionPanel) return;
    const fields = AUTOMATED_FIELDS[actionPanel.actionCode] ?? [];
    const missing = fields.filter((f) => f.required && !(automatedForm[f.key] ?? '').trim()).map((f) => f.label);
    if (missing.length > 0) {
      alert(`Fill in: ${missing.join(', ')}.`);
      return;
    }
    alert('Automated checks are not connected yet, so nothing was sent to the provider.');
    setActionPanel(null);
  };

  // Records one manual outcome for the chosen action. The panel closes only when the run is recorded.
  const submitManualAction = async () => {
    if (!canEdit || !actionPanel) return;
    const action = lead!.configuredActions.find((a) => a.code === actionPanel.actionCode);
    if (!action) return;

    if (!manualForm.outcome) {
      alert('Choose an outcome.');
      return;
    }

    const request: Record<string, unknown> = { outcome: manualForm.outcome };
    if (ACTION_TAKES_SCORE[action.code] && manualForm.score.trim()) request.score = parseInt(manualForm.score);
    if (manualForm.remarks.trim()) request.remarks = manualForm.remarks.trim();

    setRunningActions(true);
    try {
      const response = await apiPost<{ data: ActionRun[] }>(`/api/v1/leads/${lead!.leadId}/actions`, { [action.code]: request });
      const failed = response.data.find((run) => run.status === 'FAILED');
      refetch();
      if (failed) {
        alert(`${ACTION_LABELS[failed.actionCode] ?? failed.actionCode} was not recorded: ${failed.error ?? 'unknown error'}`);
      } else {
        setActionPanel(null);
      }
    } catch (err) {
      console.error('Failed to record check:', err);
      alert(err instanceof Error && err.message ? err.message : 'Failed to record check. Please try again.');
    } finally {
      setRunningActions(false);
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
  const sourceLabel = LEAD_SOURCE_LABELS[lead.leadSource] ?? lead.leadSource;
  const lastComment = comments && comments.length > 0 ? comments[0] : null;
  const requirementLabel = productTypes?.find(p => p.code === lead.productTypeCode)?.label ?? lead.productTypeCode;
  const formatDetail = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === '' ? '-' : String(value);

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
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 pb-6 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/leads')}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              ← Back to leads
            </button>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{lead.applicantName || 'Unknown Applicant'}</h1>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{sourceLabel} lead</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">Lead ID: {lead.leadId}</p>
          </div>

          <div className="flex items-center gap-3">
            {lead.convertedCustomerId ? (
              <Link
                to={`/customers/${lead.convertedCustomerId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-100"
              >
                ✓ Converted to customer
              </Link>
            ) : (
              hasRight('leads.edit') && (
                <button
                  onClick={handleOpenConvertDialog}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  Convert to customer →
                </button>
              )
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {lead.configuredActions.map((action) => {
            const outcome = latestOutcome(action.code);
            return (
              <ActionTile
                key={action.code}
                label={ACTION_LABELS[action.code] ?? action.code}
                value={outcome ?? 'Not run'}
                tone={outcome ? getCheckTone(outcome) : 'neutral'}
                onChoose={(mode) => openActionPanel(mode, action.code)}
              />
            );
          })}
          <StatusTile label="Lead status" value={lead.leadStatus} tone={getLeadStatusTone(lead.leadStatus)} />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">

          {/* Comments */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            {lastComment ? (
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  {lastComment.createdByUserName} · {new Date(lastComment.createdAt).toLocaleDateString('en-IN')}
                </p>
                <p className="truncate text-sm text-gray-800">{lastComment.commentText}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No comments added yet</p>
            )}
            <button
              onClick={() => setShowCommentsModal(true)}
              className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {lastComment ? 'View all comments' : 'Add comment'}
            </button>
          </div>

          <div className="space-y-6">
            {/* Assignment and status side by side, information full width below */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card title="Lead assignment">
                <FormField
                  label="Assigned team member"
                  value={assignedToUserId}
                  onChange={setAssignedToUserId}
                  options={userOptions}
                  disabled={!canEdit}
                />
                {lead.assignedToUserName && (
                  <p className="text-xs text-gray-500">
                    Currently assigned to <span className="font-medium text-gray-700">{lead.assignedToUserName}</span>
                  </p>
                )}
              </Card>

              <Card title="Lead status">
                <FormField
                  label="Lifecycle status"
                  value={leadStatus}
                  onChange={setLeadStatus}
                  options={LEAD_STATUSES}
                  disabled={!canEdit}
                />
              </Card>
            </div>

            <Card title="Lead information">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <InfoItem label="Financial requirement" value={requirementLabel} />
                <InfoItem label="Source" value={sourceLabel} />
                <InfoItem label="Phone" value={lead.whatsappPhoneNumber} />
                <InfoItem label="Reference" value={lead.referenceNumber ?? '-'} />
                {lead.fieldSchema.map((field) => (
                  <InfoItem key={field.key} label={field.label} value={formatDetail(lead.productDetails[field.key])} />
                ))}
              </dl>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      {canEdit && (
        <div className="flex flex-shrink-0 items-center justify-between gap-4 border-t border-gray-200 bg-white px-6 py-4">
          <p className="text-sm text-gray-500">Changes to assignment and lead status will be saved.</p>
          <button
            onClick={handleSaveChanges}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}

      {/* Action modals: Manual (status and score), Automated (required fields), History (runs for one action) */}
      {actionPanel && lead && (() => {
        const action = lead.configuredActions.find((a) => a.code === actionPanel.actionCode);
        if (!action) return null;
        const label = ACTION_LABELS[action.code] ?? action.code;
        const close = () => setActionPanel(null);
        const runs = lead.actionHistory.filter((run) => run.actionCode === action.code);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">{ACTION_MODE_LABELS[actionPanel.mode]} · {label}</h2>
                <button onClick={close} className="text-2xl font-light text-gray-400 hover:text-gray-600">×</button>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                {actionPanel.mode === 'manual' && (
                  <>
                    {!canEdit && (
                      <p className="text-sm text-amber-700">
                        {lead.isLocked ? 'This lead is converted, so its checks are locked.' : 'You do not have permission to record checks.'}
                      </p>
                    )}
                    <FormField
                      label="Status"
                      value={manualForm.outcome}
                      onChange={(v) => setManualForm({ ...manualForm, outcome: v })}
                      options={OUTCOME_OPTIONS}
                      required
                      disabled={!canEdit}
                    />
                    {ACTION_TAKES_SCORE[action.code] && (
                      <FormField
                        label="Score"
                        type="number"
                        value={manualForm.score}
                        onChange={(v) => setManualForm({ ...manualForm, score: v })}
                        placeholder="750"
                        disabled={!canEdit}
                      />
                    )}
                    <TextAreaField
                      label="Remarks"
                      value={manualForm.remarks}
                      onChange={(v) => setManualForm({ ...manualForm, remarks: v })}
                      placeholder="Notes about this check"
                      disabled={!canEdit}
                    />
                  </>
                )}

                {actionPanel.mode === 'automated' && (
                  <>
                    <p className="text-sm text-gray-600">Fields required for the automated {label.toLowerCase()}:</p>
                    {(AUTOMATED_FIELDS[action.code] ?? []).map((field) => (
                      <FormField
                        key={field.key}
                        label={field.label}
                        value={automatedForm[field.key] ?? ''}
                        onChange={(v) => setAutomatedForm({ ...automatedForm, [field.key]: v })}
                        required={field.required}
                      />
                    ))}
                  </>
                )}

                {actionPanel.mode === 'history' && (
                  runs.length === 0 ? (
                    <p className="text-sm text-gray-500">No checks recorded for this action yet.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {runs.map((run) => (
                        <li key={run.executionId} className="py-3 text-sm">
                          <p className="text-xs text-gray-500">
                            {new Date(run.startedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                          {run.status === 'FAILED' ? (
                            <p className="text-red-700">Not recorded: {run.error ?? 'unknown error'}</p>
                          ) : (
                            <p className="text-gray-900">
                              {OUTCOME_OPTIONS.find((o) => o.value === run.response?.outcome)?.label ?? run.response?.outcome}
                              {run.response?.score != null && ` · score ${run.response.score}`}
                              {run.response?.remarks && ` · ${run.response.remarks}`}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                {actionPanel.mode === 'history' ? (
                  <button onClick={close} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Close</button>
                ) : (
                  <>
                    <button onClick={close} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Cancel</button>
                    {actionPanel.mode === 'manual' ? (
                      <button
                        onClick={submitManualAction}
                        disabled={!canEdit || runningActions}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {runningActions ? 'Saving…' : 'Save'}
                      </button>
                    ) : (
                      <button
                        onClick={submitAutomatedCheck}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Submit
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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

                      {/* Vehicle conflicts: the vehicle holds a different value from the lead. Each needs a choice. */}
                      {conversionPreview.vehicle && conversionPreview.vehicle.conflicts.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">Vehicle details differ</p>
                            <p className="text-xs text-gray-600">
                              Choose which value to keep for each field. Blank vehicle fields are filled from the lead.
                            </p>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-500">
                                <th className="pb-2 font-medium">Field</th>
                                <th className="pb-2 font-medium">Vehicle</th>
                                <th className="pb-2 font-medium">Lead</th>
                                <th className="pb-2 font-medium">Keep</th>
                              </tr>
                            </thead>
                            <tbody>
                              {conversionPreview.vehicle.conflicts.map((conflict) => (
                                <tr key={conflict.role} className="border-t border-gray-100">
                                  <td className="py-2 font-medium text-gray-900">
                                    {ROLE_OPTIONS.find((r) => r.value === conflict.role)?.label ?? conflict.field}
                                  </td>
                                  <td className="py-2 text-gray-700">{conflict.currentValue}</td>
                                  <td className="py-2 text-gray-700">{conflict.leadValue}</td>
                                  <td className="py-2">
                                    <div className="flex gap-3">
                                      {(['VEHICLE', 'LEAD'] as const).map((choice) => (
                                        <label key={choice} className="flex items-center gap-1 text-xs text-gray-700">
                                          <input
                                            type="radio"
                                            name={`conflict-${conflict.role}`}
                                            checked={conflictDecisions[conflict.role] === choice}
                                            onChange={() => setConflictDecisions({ ...conflictDecisions, [conflict.role]: choice })}
                                          />
                                          {choice === 'VEHICLE' ? 'Vehicle' : 'Lead'}
                                        </label>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

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
                  undecidedConflicts.length > 0 ||
                  (conversionMode === 'existing' && (!selectedCustomerId || (conversionPreview?.vehicle?.status === 'OWNED_BY_OTHER' && !confirmVehicleTransfer) || conversionPreview?.vehicle?.status === 'BLOCKED'))
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

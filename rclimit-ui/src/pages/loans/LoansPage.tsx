import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiGet, apiPost } from '../../api/client';
import DataTable, { type Column } from '../../components/DataTable';
import Badge from '../../components/Badge';
import { statusVariant } from '../../components/badgeVariants';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import Pagination from '../../components/Pagination';
import { useListState } from '../../hooks/useListState';

interface Loan {
  loanId: string;
  applicationNumber: string;
  customerName: string;
  vehicleRegNo: string;
  lenderName: string;
  requestedAmount: number;
  sanctionedAmount: number | null;
  netDisbursedAmount: number;
  loanStatus: string;
  disbursalDate: string | null;
}

interface VehicleOption { vehicleId: string; registrationNumber: string }

interface SelectItem { value: string; label: string }

const PRODUCT_TYPES = [
  { value: 'USED_CV', label: 'Used CV' },
  { value: 'NEW_CV', label: 'New CV' },
  { value: 'REFINANCE', label: 'Refinance' },
];

const emptyForm = {
  customerId: '', vehicleId: '', poolId: '', partnerId: '',
  productType: 'USED_CV', lenderAgreementNumber: '', requestedAmount: '',
  bankPayoutPctAmt: '0', bonusPayoutAmt: '0', sharedPayoutAmt: '0', remarks: '',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function LoansPage() {
  const list = useListState({
    storageKey: 'loans.pageSize',
    defaultSortBy: 'createdAt',
    defaultSortDir: 'desc',
    initialFilters: {},
  });
  const { data, meta, loading, refetch } = useFetch<Loan[]>(`/api/v1/loans?${list.query}`);
  const { data: customers } = useFetch<{ customerId: string; legalName: string }[]>('/api/v1/customers/lookup');
  const { data: bankPools } = useFetch<{ poolId: string; lenderId: string; lenderName: string; facilityAccountNumber: string; sanctionedLimit: number; utilizedAmount: number }[]>('/api/v1/bank-pools');
  const { data: partners } = useFetch<{ partnerId: string; legalName: string }[]>('/api/v1/partners/lookup');
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only the selected customer's vehicles can be chosen (spec: loan creation rules).
  useEffect(() => {
    if (!form.customerId) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    setLoadingVehicles(true);
    apiGet<{ data: VehicleOption[] }>(`/api/v1/customers/${form.customerId}/vehicles`)
      .then((res) => { if (!cancelled) setVehicles(res.data ?? []); })
      .catch(() => { if (!cancelled) setVehicles([]); })
      .finally(() => { if (!cancelled) setLoadingVehicles(false); });
    return () => { cancelled = true; };
  }, [form.customerId]);

  const columns: Column<Loan>[] = [
    { key: 'applicationNumber', header: 'Application #', sortKey: 'applicationNumber' },
    { key: 'customerName', header: 'Customer', sortKey: 'customerName' },
    { key: 'vehicleRegNo', header: 'Vehicle Reg' },
    { key: 'lenderName', header: 'Lender' },
    { key: 'requestedAmount', header: 'Requested', sortKey: 'requestedAmount', render: (l) => formatCurrency(l.requestedAmount) },
    { key: 'sanctionedAmount', header: 'Sanctioned', sortKey: 'sanctionedAmount', render: (l) => (l.sanctionedAmount == null ? '-' : formatCurrency(l.sanctionedAmount)) },
    { key: 'netDisbursedAmount', header: 'AF Balance', sortKey: 'netDisbursedAmount', render: (l) => formatCurrency(l.netDisbursedAmount) },
    { key: 'loanStatus', header: 'Status', sortKey: 'loanStatus', render: (l) => <Badge text={l.loanStatus} variant={statusVariant(l.loanStatus)} /> },
    { key: 'disbursalDate', header: 'Disbursed', sortKey: 'disbursalDate', render: (l) => formatDate(l.disbursalDate) },
  ];

  const toOptions = (items: SelectItem[] | null): { value: string; label: string }[] =>
    items?.map((i) => ({ value: i.value, label: i.label })) ?? [];

  const openModal = () => {
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/api/v1/loans', {
        customerId: form.customerId,
        vehicleId: form.vehicleId,
        poolId: form.poolId,
        partnerId: form.partnerId || null,
        lenderAgreementNumber: form.lenderAgreementNumber || null,
        productType: form.productType,
        requestedAmount: parseFloat(form.requestedAmount),
        bankPayoutPctAmt: parseFloat(form.bankPayoutPctAmt) || 0,
        bonusPayoutAmt: parseFloat(form.bonusPayoutAmt) || 0,
        sharedPayoutAmt: parseFloat(form.sharedPayoutAmt) || 0,
        remarks: form.remarks || null,
      });
      setShowModal(false);
      // Keep the current page and filters; a changed page refetches on its own.
      if (list.page === 1) refetch();
      else list.setPage(1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to create the loan file.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">All Loans</h2>
        <button onClick={openModal} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Create Loan
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        onRowClick={(loan) => navigate(`/loans/${loan.loanId}`)}
        searchPlaceholder="Search application #, customer, vehicle or agreement..."
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Loan File">
        <form onSubmit={handleSubmit}>
          <FormField
            label="Customer"
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v, vehicleId: '' })}
            required
            options={toOptions(customers?.map((c) => ({ value: c.customerId, label: c.legalName })) ?? null)}
          />
          <FormField
            label="Vehicle"
            value={form.vehicleId}
            onChange={(v) => setForm({ ...form, vehicleId: v })}
            required
            disabled={!form.customerId || loadingVehicles}
            options={vehicles.map((v) => ({ value: v.vehicleId, label: v.registrationNumber }))}
          />
          {form.customerId && !loadingVehicles && vehicles.length === 0 && (
            <p className="-mt-2 mb-3 text-xs text-amber-700">This customer owns no vehicles. Add a vehicle to the customer first.</p>
          )}
          <FormField label="Bank Pool (Lender Facility)" value={form.poolId} onChange={(v) => setForm({ ...form, poolId: v })} required options={toOptions(bankPools?.map((p) => ({ value: p.poolId, label: `${p.lenderName} — ${p.facilityAccountNumber}` })) ?? null)} />
          <FormField label="Product Type" value={form.productType} onChange={(v) => setForm({ ...form, productType: v })} required options={PRODUCT_TYPES} />
          <FormField label="Requested Amount (₹)" type="number" value={form.requestedAmount} onChange={(v) => setForm({ ...form, requestedAmount: v })} required />
          <FormField label="Lender Agreement No." value={form.lenderAgreementNumber} onChange={(v) => setForm({ ...form, lenderAgreementNumber: v })} />
          <FormField label="Partner (optional)" value={form.partnerId} onChange={(v) => setForm({ ...form, partnerId: v })} options={toOptions(partners?.map((p) => ({ value: p.partnerId, label: p.legalName })) ?? null)} />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Payout" type="number" value={form.bankPayoutPctAmt} onChange={(v) => setForm({ ...form, bankPayoutPctAmt: v })} />
            <FormField label="Bonus" type="number" value={form.bonusPayoutAmt} onChange={(v) => setForm({ ...form, bonusPayoutAmt: v })} />
            <FormField label="Shared" type="number" value={form.sharedPayoutAmt} onChange={(v) => setForm({ ...form, sharedPayoutAmt: v })} />
          </div>
          <FormField label="Remarks" value={form.remarks} onChange={(v) => setForm({ ...form, remarks: v })} />
          <p className="text-xs text-gray-500">The sanctioned amount, tenure and rate are captured when the loan is sanctioned.</p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

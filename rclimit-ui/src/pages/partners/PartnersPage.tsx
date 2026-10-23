import { useState } from 'react';
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

interface Partner {
  partnerId: string;
  legalName: string;
  partnerType: string;
  phoneNumber: string;
  defaultCommissionSplitPct: number;
  status: string;
}

export default function PartnersPage() {
  const list = useListState({
    storageKey: 'partners.pageSize',
    defaultSortBy: 'legalName',
    defaultSortDir: 'asc',
    initialFilters: {},
  });
  const { data, meta, loading, refetch } = useFetch<Partner[]>(`/api/v1/partners?${list.query}`);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ legalName: '', partnerType: 'SUB_BROKER', phoneNumber: '', defaultCommissionSplitPct: '70' });
  const [submitting, setSubmitting] = useState(false);

  const columns: Column<Partner>[] = [
    { key: 'legalName', header: 'Legal Name', sortKey: 'legalName' },
    { key: 'partnerType', header: 'Type', sortKey: 'partnerType', render: (p) => <Badge text={p.partnerType.replace('_', ' ')} variant="info" /> },
    { key: 'phoneNumber', header: 'Phone' },
    { key: 'defaultCommissionSplitPct', header: 'Commission %', render: (p) => `${p.defaultCommissionSplitPct}%` },
    { key: 'status', header: 'Status', sortKey: 'status', render: (p) => <Badge text={p.status} variant={statusVariant(p.status)} /> },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/api/v1/partners', {
        legalName: form.legalName,
        partnerType: form.partnerType,
        phoneNumber: toPhoneNumber(form.phoneNumber),
        defaultCommissionSplitPct: parseFloat(form.defaultCommissionSplitPct),
      });
      setShowModal(false);
      setForm({ legalName: '', partnerType: 'SUB_BROKER', phoneNumber: '', defaultCommissionSplitPct: '70' });
      // Keep the current page and filters; a changed page refetches on its own.
      if (list.page === 1) refetch();
      else list.setPage(1);
    } catch {
      // handle
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">All Partners</h2>
        <button onClick={() => setShowModal(true)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Partner
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        searchPlaceholder="Search name or phone..."
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Partner">
        <form onSubmit={handleSubmit}>
          <FormField label="Legal Name" value={form.legalName} onChange={(v) => setForm({ ...form, legalName: v })} required />
          <FormField label="Type" value={form.partnerType} onChange={(v) => setForm({ ...form, partnerType: v })} options={[{ value: 'SUB_BROKER', label: 'Sub-Broker' }, { value: 'DSA_AGENT', label: 'DSA Agent' }]} />
          <PhoneInput label="Phone" value={form.phoneNumber} onChange={(v) => setForm({ ...form, phoneNumber: v })} />
          <FormField label="Commission Split (%)" type="number" value={form.defaultCommissionSplitPct} onChange={(v) => setForm({ ...form, defaultCommissionSplitPct: v })} required />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { apiPost, apiPut } from '../../api/client';
import Badge, { statusVariant } from '../../components/Badge';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';

interface Customer {
  customerId: string;
  customerType: string;
  legalName: string;
  tradeName: string | null;
  phoneNumber: string | null;
  cibilScore: number | null;
  cibilTier: string | null;
  riskStatus: string;
  assignedCeiling: number;
  currentUtilization: number;
  availableSubLimit: number;
  pendingRcCount: number;
  maxPendingRcAllowed: number;
  stopSupplyFlag: boolean;
}

interface Vehicle {
  vehicleId: string;
  registrationNumber: string;
  chassisNumber: string | null;
  engineNumber: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  yearOfMfg: number | null;
  ownershipCount: number;
  ownerCustomerId: string | null;
  currentRtoStatus: string;
}

const emptyVehicleForm = {
  registrationNumber: '', chassisNumber: '', engineNumber: '',
  make: '', model: '', variant: '', yearOfMfg: '',
  ownershipCount: '1', currentRtoStatus: 'CLEAN',
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, loading: custLoading } = useFetch<Customer>(`/api/v1/customers/${id}`);
  const { data: vehicles, loading: vehLoading, refetch } = useFetch<Vehicle[]>(`/api/v1/customers/${id}/vehicles`);

  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyVehicleForm);
  const [submitting, setSubmitting] = useState(false);

  const openAdd = () => {
    setEditVehicle(null);
    setForm(emptyVehicleForm);
    setShowModal(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setForm({
      registrationNumber: v.registrationNumber,
      chassisNumber: v.chassisNumber ?? '',
      engineNumber: v.engineNumber ?? '',
      make: v.make ?? '',
      model: v.model ?? '',
      variant: v.variant ?? '',
      yearOfMfg: v.yearOfMfg?.toString() ?? '',
      ownershipCount: v.ownershipCount.toString(),
      currentRtoStatus: v.currentRtoStatus,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editVehicle) {
        await apiPut(`/api/v1/vehicles/${editVehicle.vehicleId}`, {
          registrationNumber: form.registrationNumber,
          chassisNumber: form.chassisNumber || null,
          engineNumber: form.engineNumber || null,
          make: form.make || null,
          model: form.model || null,
          variant: form.variant || null,
          yearOfMfg: form.yearOfMfg ? parseInt(form.yearOfMfg) : null,
          ownershipCount: parseInt(form.ownershipCount) || 1,
          ownerCustomerId: id,
          currentRtoStatus: form.currentRtoStatus,
        });
      } else {
        await apiPost(`/api/v1/customers/${id}/vehicles`, {
          registrationNumber: form.registrationNumber,
          chassisNumber: form.chassisNumber || null,
          engineNumber: form.engineNumber || null,
          make: form.make || null,
          model: form.model || null,
          variant: form.variant || null,
          yearOfMfg: form.yearOfMfg ? parseInt(form.yearOfMfg) : null,
        });
      }
      setShowModal(false);
      refetch();
    } catch {
      // handle error
    } finally {
      setSubmitting(false);
    }
  };

  if (custLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>;
  }

  if (!customer) {
    return <div className="text-center text-gray-500 py-12">Customer not found</div>;
  }

  const pct = customer.assignedCeiling > 0 ? (customer.currentUtilization / customer.assignedCeiling) * 100 : 0;

  return (
    <div>
      <button onClick={() => navigate('/customers')} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-flex items-center gap-1">
        &larr; Back to Customers
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{customer.legalName}</h2>
            {customer.tradeName && <p className="text-sm text-gray-500">{customer.tradeName}</p>}
          </div>
          <div className="flex gap-2">
            <Badge text={customer.customerType} variant="neutral" />
            <Badge text={customer.riskStatus} variant={statusVariant(customer.riskStatus)} />
            {customer.stopSupplyFlag && <Badge text="STOP SUPPLY" variant="danger" />}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Phone</span>
            <p className="font-medium">{customer.phoneNumber ?? '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">CIBIL Score</span>
            <p className="font-medium">{customer.cibilScore ?? '-'} {customer.cibilTier && <Badge text={customer.cibilTier} variant={statusVariant(customer.cibilTier)} />}</p>
          </div>
          <div>
            <span className="text-gray-500">Pending RCs</span>
            <p className="font-medium">{customer.pendingRcCount} / {customer.maxPendingRcAllowed}</p>
          </div>
          <div>
            <span className="text-gray-500">Sub-Limit</span>
            <p className="font-medium">{formatCurrency(customer.currentUtilization)} / {formatCurrency(customer.assignedCeiling)}</p>
            <div className="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden w-full max-w-[200px]">
              <div
                className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Vehicles</h3>
        <button onClick={openAdd} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
          Add Vehicle
        </button>
      </div>

      {vehLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}</div>
      ) : !vehicles || vehicles.length === 0 ? (
        <div className="text-center text-gray-500 py-8 bg-white border border-gray-200 rounded-lg">No vehicles registered for this customer</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg. Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Make / Model</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chassis No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engine No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ownership</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RTO Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vehicles.map((v) => (
                <tr key={v.vehicleId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{v.registrationNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{[v.make, v.model, v.variant].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{v.yearOfMfg ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{v.chassisNumber ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{v.engineNumber ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{v.ownershipCount}</td>
                  <td className="px-4 py-3 text-sm"><Badge text={v.currentRtoStatus} variant={statusVariant(v.currentRtoStatus)} /></td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => openEdit(v)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">{vehicles?.length ?? 0} vehicle{(vehicles?.length ?? 0) !== 1 ? 's' : ''}</p>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Registration Number" value={form.registrationNumber} onChange={(v) => setForm({ ...form, registrationNumber: v })} required placeholder="e.g. GJ05BX6637" />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} placeholder="e.g. Tata" />
            <FormField label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="e.g. Prima 2830.K" />
            <FormField label="Variant" value={form.variant} onChange={(v) => setForm({ ...form, variant: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Year of Mfg" type="number" value={form.yearOfMfg} onChange={(v) => setForm({ ...form, yearOfMfg: v })} />
            <FormField label="Ownership Count" type="number" value={form.ownershipCount} onChange={(v) => setForm({ ...form, ownershipCount: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Chassis Number" value={form.chassisNumber} onChange={(v) => setForm({ ...form, chassisNumber: v })} />
            <FormField label="Engine Number" value={form.engineNumber} onChange={(v) => setForm({ ...form, engineNumber: v })} />
          </div>
          <FormField label="RTO Status" value={form.currentRtoStatus} onChange={(v) => setForm({ ...form, currentRtoStatus: v })} options={[
            { value: 'CLEAN', label: 'Clean' },
            { value: 'HYPOTHECATED', label: 'Hypothecated' },
            { value: 'RC_PENDING', label: 'RC Pending' },
            { value: 'BLACKLISTED', label: 'Blacklisted' },
          ]} />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Saving...' : editVehicle ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

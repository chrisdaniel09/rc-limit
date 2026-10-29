import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import Badge from '../../components/Badge';
import { statusVariant } from '../../components/badgeVariants';

interface LedgerRow {
  lineItemId: string;
  loanId: string;
  entryDate: string;
  applicationNumber: string;
  customerName: string;
  vehicleRegNo: string;
  lenderName: string;
  loanStatus: string;
  entryDirection: 'CREDIT' | 'DEBIT';
  counterparty: string;
  particularType: string;
  creditAmount: number | null;
  debitAmount: number | null;
  runningBalanceAmt: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none';

// The RC Limit Ledger: ledger entries across loans (spec section 4.D).
export default function RcLimitLedgerPage() {
  const navigate = useNavigate();
  const { data: customers } = useFetch<{ customerId: string; legalName: string }[]>('/api/v1/customers/lookup');
  const { data: bankPools } = useFetch<{ poolId: string; lenderName: string; facilityAccountNumber: string }[]>('/api/v1/bank-pools');

  const [customerId, setCustomerId] = useState('');
  const [poolId, setPoolId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [balanceStatus, setBalanceStatus] = useState('');
  // Hides bank credits paid straight to a customer. Running balances are unaffected (decision C1).
  const [hideDirectCustomerCredits, setHideDirectCustomerCredits] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (poolId) params.set('poolId', poolId);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (balanceStatus) params.set('hasOpenBalance', balanceStatus === 'OPEN_BALANCE' ? 'true' : 'false');
    if (hideDirectCustomerCredits) params.set('hideDirectCustomerCredits', 'true');
    return params.toString();
  }, [customerId, poolId, startDate, endDate, balanceStatus, hideDirectCustomerCredits]);

  const { data: rows, loading } = useFetch<LedgerRow[]>(`/api/v1/loans/rc-limit-ledger?${query}`);

  const totals = useMemo(() => (rows ?? []).reduce(
    (acc, r) => ({ credit: acc.credit + (r.creditAmount ?? 0), debit: acc.debit + (r.debitAmount ?? 0) }),
    { credit: 0, debit: 0 },
  ), [rows]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm font-medium text-gray-700">
            Customer
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
              <option value="">All customers</option>
              {(customers ?? []).map((c) => <option key={c.customerId} value={c.customerId}>{c.legalName}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Bank Pool
            <select value={poolId} onChange={(e) => setPoolId(e.target.value)} className={inputClass}>
              <option value="">All pools</option>
              {(bankPools ?? []).map((p) => <option key={p.poolId} value={p.poolId}>{p.lenderName} — {p.facilityAccountNumber}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            From
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            To
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Status
            <select value={balanceStatus} onChange={(e) => setBalanceStatus(e.target.value)} className={inputClass}>
              <option value="">All</option>
              <option value="OPEN_BALANCE">Open balance</option>
              <option value="SETTLED">Settled</option>
            </select>
          </label>
        </div>
        <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={hideDirectCustomerCredits}
            onChange={(e) => setHideDirectCustomerCredits(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Hide direct customer credits
          <span className="text-xs text-gray-400">(bank credits paid straight to the customer; balances are unchanged)</span>
        </label>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4 flex flex-wrap gap-6 text-sm">
          <div><span className="text-gray-500">Credits shown</span><p className="font-semibold text-green-700">{formatCurrency(totals.credit)}</p></div>
          <div><span className="text-gray-500">Debits shown</span><p className="font-semibold text-red-600">{formatCurrency(totals.debit)}</p></div>
          <div><span className="text-gray-500">Entries</span><p className="font-semibold text-gray-900">{rows?.length ?? 0}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Application #', 'Customer', 'Vehicle', 'Lender', 'Entry', 'Counterparty', 'Particular'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
                {['Credit', 'Debit', 'Balance'].map((h) => (
                  <th key={h} className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={11} className="px-3 py-6 text-center text-sm text-gray-500">Loading...</td></tr>
              ) : (rows ?? []).length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-6 text-center text-sm text-gray-500">No ledger entries match these filters</td></tr>
              ) : (
                (rows ?? []).map((r) => (
                  <tr key={r.lineItemId} onClick={() => navigate(`/loans/${r.loanId}`)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(r.entryDate)}</td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {r.applicationNumber}
                      <div><Badge text={r.loanStatus} variant={statusVariant(r.loanStatus)} /></div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.customerName}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.vehicleRegNo}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.lenderName}</td>
                    <td className="px-3 py-2 text-sm"><Badge text={r.entryDirection} variant={r.entryDirection === 'CREDIT' ? 'success' : 'neutral'} /></td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.counterparty.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{r.particularType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-sm text-green-700 text-right font-medium">{r.creditAmount != null ? formatCurrency(r.creditAmount) : ''}</td>
                    <td className="px-3 py-2 text-sm text-red-600 text-right font-medium">{r.debitAmount != null ? formatCurrency(r.debitAmount) : ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-medium">{formatCurrency(r.runningBalanceAmt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

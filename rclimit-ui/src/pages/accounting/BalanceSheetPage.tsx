import { useFetch } from '../../hooks/useFetch';

interface BalanceSheetGroup {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

interface BalanceSheet {
  assets: BalanceSheetGroup[];
  liabilities: BalanceSheetGroup[];
  equity: BalanceSheetGroup[];
  income: BalanceSheetGroup[];
  expenses: BalanceSheetGroup[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);

function Section({ title, items, total, color }: { title: string; items: BalanceSheetGroup[]; total: number; color: string }) {
  return (
    <div className="mb-6">
      <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${color}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 pl-2">No accounts with activity</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
              <th className="pb-2 pl-2">Code</th>
              <th className="pb-2">Account</th>
              <th className="pb-2 text-right pr-2">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.accountId} className="hover:bg-gray-50">
                <td className="py-2 pl-2 font-mono text-gray-600">{item.accountCode}</td>
                <td className="py-2 text-gray-700">{item.accountName}</td>
                <td className="py-2 text-right pr-2 font-mono text-gray-800">{formatCurrency(item.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td colSpan={2} className="pt-2 pl-2">Total {title}</td>
              <td className="pt-2 text-right pr-2 font-mono">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

export default function BalanceSheetPage() {
  const { data, loading } = useFetch<BalanceSheet>('/api/v1/accounting/balance-sheet');

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-50 rounded animate-pulse" />)}
      </div>
    );
  }

  if (!data) return <p className="text-sm text-gray-500">No data available.</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Balance Sheet</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Section title="Assets" items={data.assets} total={data.totalAssets} color="text-green-700" />
          <Section title="Income" items={data.income} total={data.totalIncome} color="text-emerald-700" />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <Section title="Liabilities" items={data.liabilities} total={data.totalLiabilities} color="text-red-700" />
          <Section title="Equity" items={data.equity} total={data.totalEquity} color="text-blue-700" />
          <Section title="Expenses" items={data.expenses} total={data.totalExpenses} color="text-amber-700" />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Assets</p>
            <p className="text-lg font-semibold text-green-700">{formatCurrency(data.totalAssets)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Liabilities</p>
            <p className="text-lg font-semibold text-red-700">{formatCurrency(data.totalLiabilities)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Equity</p>
            <p className="text-lg font-semibold text-blue-700">{formatCurrency(data.totalEquity)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Net Income</p>
            <p className="text-lg font-semibold text-emerald-700">{formatCurrency(data.totalIncome - data.totalExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Net Balance</p>
            <p className={`text-lg font-semibold ${data.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(data.netBalance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

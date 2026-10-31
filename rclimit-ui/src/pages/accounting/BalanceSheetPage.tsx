import { Printer, RotateCw } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { MetricCard, MetricStrip } from '@/components/metrics';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/layouts/templates';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';

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

// A statement section: neutral surfaces, tabular amounts, subtotal row.
function Section({ title, items, total }: { title: string; items: BalanceSheetGroup[]; total: number }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="border-b px-cell py-2 text-subheading">{title}</h3>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {items.length === 0 ? (
            <tr><td className="px-cell py-2 text-muted-foreground">No accounts with activity</td></tr>
          ) : items.map((item) => (
            <tr key={item.accountId} className="h-9">
              <td className="px-cell"><span className="id-mono mr-3 text-muted-foreground">{item.accountCode}</span>{item.accountName}</td>
              <td className={cn('num whitespace-nowrap px-cell text-right', item.balance < 0 && 'text-danger')}>{formatINR(item.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="h-10 border-t-2 font-semibold">
            <td className="px-cell">Total {title.toLowerCase()}</td>
            <td className="num whitespace-nowrap px-cell text-right">{formatINR(total)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

// §10.13 Balance sheet: two-column statement with subtotals and a print layout.
export default function BalanceSheetPage() {
  const { data, loading, error, refetch } = useFetch<BalanceSheet>('/api/v1/accounting/balance-sheet');

  return (
    <>
      <PageHeader
        title="Balance sheet"
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" icon={RotateCw} loading={loading} onClick={() => void refetch()}>Refresh</Button>
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
          </div>
        }
      />
      {error && <Alert tone="danger" title="The balance sheet didn't load">{error}</Alert>}
      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      ) : data && (
        <div className="space-y-4">
          <MetricStrip columns={5}>
            <MetricCard label="Total assets" value={formatINR(data.totalAssets, { whole: true })} />
            <MetricCard label="Total liabilities" value={formatINR(data.totalLiabilities, { whole: true })} />
            <MetricCard label="Total equity" value={formatINR(data.totalEquity, { whole: true })} />
            <MetricCard label="Net income" value={formatINR(data.totalIncome - data.totalExpenses, { whole: true })} contextTone={data.totalIncome - data.totalExpenses < 0 ? 'danger' : undefined} context={data.totalIncome - data.totalExpenses < 0 ? 'Loss' : undefined} />
            <MetricCard label="Net balance" value={formatINR(data.netBalance, { whole: true })} context={data.netBalance === 0 ? 'Balanced' : 'Out of balance'} contextTone={data.netBalance === 0 ? 'success' : 'warning'} />
          </MetricStrip>
          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <Card flush>
              <Section title="Assets" items={data.assets} total={data.totalAssets} />
              <Section title="Income" items={data.income} total={data.totalIncome} />
            </Card>
            <Card flush>
              <Section title="Liabilities" items={data.liabilities} total={data.totalLiabilities} />
              <Section title="Equity" items={data.equity} total={data.totalEquity} />
              <Section title="Expenses" items={data.expenses} total={data.totalExpenses} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

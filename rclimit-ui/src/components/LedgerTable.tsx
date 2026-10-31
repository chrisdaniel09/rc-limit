import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { EMPTY, formatDate, formatINR, formatRegNo, formatSignedINR, humanize } from '@/lib/format';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Tooltip } from '@/components/ui/tooltip';
import StatusBadge from './StatusBadge';

// §8.7 LedgerTable: one component for the loan ledger, the RC limit ledger (cross-loan) and journal views.

export interface LedgerRow {
  id: string;
  date: string;
  direction: 'CREDIT' | 'DEBIT';
  counterparty: string;
  particular?: string | null;
  mode?: string | null;
  bank?: string | null;
  accountNo?: string | null;
  txnId?: string | null;
  credit: number | null;
  debit: number | null;
  balance: number | null;
  // Paid straight to the customer: recorded, but the broker balance doesn't move.
  balanceUnchanged?: boolean;
  loan?: { loanId: string; applicationNumber: string; customerName: string; vehicleRegNo: string; lenderName: string; loanStatus: string };
}

interface LedgerTableProps {
  rows: LedgerRow[];
  loading?: boolean;
  // Adds Application #, Customer, Vehicle, Lender.
  crossLoan?: boolean;
  counterpartyLabel?: (code: string) => string;
  particularLabel?: (code: string) => string;
  closingBalance?: number | null;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  onOpenLoan?: (loanId: string) => void;
}

const UNCHANGED = 'Paid straight to the customer; balance unchanged.';

function reference(row: LedgerRow): string {
  return [row.mode && humanize(row.mode), row.bank, row.txnId].filter(Boolean).join(' · ') || EMPTY;
}

function BalanceCell({ row }: { row: LedgerRow }) {
  if (row.balance == null) return <span className="text-muted-foreground">{EMPTY}</span>;
  if (row.balanceUnchanged) {
    return (
      <Tooltip content={UNCHANGED}>
        <span tabIndex={0} className="inline-flex items-center gap-1 text-muted-foreground">
          <Info aria-label={UNCHANGED} className="size-3.5" />
          {formatINR(row.balance)}
        </span>
      </Tooltip>
    );
  }
  return <span className={cn('font-medium', row.balance < 0 ? 'text-danger' : 'text-foreground')}>{formatINR(row.balance)}</span>;
}

export default function LedgerTable({
  rows, loading, crossLoan, counterpartyLabel = humanize, particularLabel = humanize, closingBalance,
  emptyTitle = 'No ledger entries yet', emptyDescription, emptyAction, onOpenLoan,
}: LedgerTableProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const totals = rows.reduce((t, r) => ({ credit: t.credit + (r.credit ?? 0), debit: t.debit + (r.debit ?? 0) }), { credit: 0, debit: 0 });
  const closing = closingBalance !== undefined ? closingBalance : rows.length ? rows[rows.length - 1].balance : null;

  if (loading && rows.length === 0) {
    return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>;
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const loanLink = (row: LedgerRow, className?: string) => row.loan && (
    <Link
      to={`/loans/${row.loan.loanId}`}
      onClick={(e) => {
        if (onOpenLoan && !e.metaKey && !e.ctrlKey && e.button === 0) {
          e.preventDefault();
          onOpenLoan(row.loan!.loanId);
        }
      }}
      className={cn('id-mono font-medium text-foreground hover:underline', className)}
    >
      {row.loan.applicationNumber}
    </Link>
  );

  if (isMobile) {
    return (
      <div>
        <ul className="divide-y">
          {rows.map((row) => {
            const amount = row.direction === 'CREDIT' ? row.credit : row.debit;
            return (
              <li key={row.id} className="space-y-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-caption text-muted-foreground">{formatDate(row.date)}</span>
                  <StatusBadge status={row.direction} />
                </div>
                {row.loan && <div className="text-sm">{loanLink(row)} <span className="text-muted-foreground">· {row.loan.customerName}</span></div>}
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="truncate text-foreground">{counterpartyLabel(row.counterparty)}</p>
                    {row.particular && <p className="truncate text-caption text-muted-foreground">{particularLabel(row.particular)}</p>}
                  </div>
                  <span className={cn('num shrink-0 text-base font-semibold', row.direction === 'CREDIT' ? 'text-success' : 'text-danger')}>
                    {formatSignedINR(amount, row.direction)}
                  </span>
                </div>
                <p className="num text-right text-caption text-muted-foreground">
                  Balance after {row.balanceUnchanged ? <span title={UNCHANGED}>{formatINR(row.balance)} (unchanged)</span> : formatINR(row.balance)}
                </p>
              </li>
            );
          })}
        </ul>
        <dl className="num grid grid-cols-3 gap-2 border-t bg-muted/40 px-4 py-3 text-caption">
          <div><dt className="text-muted-foreground">Credits</dt><dd className="font-semibold text-success">{formatINR(totals.credit)}</dd></div>
          <div><dt className="text-muted-foreground">Debits</dt><dd className="font-semibold text-danger">{formatINR(totals.debit)}</dd></div>
          <div className="text-right"><dt className="text-muted-foreground">Closing</dt><dd className="font-semibold text-foreground">{formatINR(closing)}</dd></div>
        </dl>
      </div>
    );
  }

  const colCount = (crossLoan ? 10 : 7) + 1;
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-busy={loading || undefined}>
        <thead className="bg-muted">
          <tr className="text-left text-label text-muted-foreground">
            <th scope="col" className="w-8"><span className="sr-only">Details</span></th>
            <th scope="col" className="h-10 px-cell font-medium">Date</th>
            {crossLoan && <th scope="col" className="px-cell font-medium">Application #</th>}
            {crossLoan && <th scope="col" className="px-cell font-medium">Customer</th>}
            {crossLoan && <th scope="col" className="hidden px-cell font-medium xl:table-cell">Vehicle</th>}
            <th scope="col" className="px-cell font-medium">Entry</th>
            <th scope="col" className="px-cell font-medium">Counterparty</th>
            <th scope="col" className="hidden px-cell font-medium lg:table-cell">Reference</th>
            <th scope="col" className="px-cell text-right font-medium">Credit</th>
            <th scope="col" className="px-cell text-right font-medium">Debit</th>
            <th scope="col" className="px-cell text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const open = expanded.has(row.id);
            return (
              <Fragment key={row.id}>
                <tr className={cn('h-row hover:bg-muted/40', open && 'bg-muted/40')}>
                  <td className="pl-2">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={open ? 'Hide reference details' : 'Show reference details'}
                      onClick={() => toggle(row.id)}
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
                    </button>
                  </td>
                  <td className="num whitespace-nowrap px-cell text-foreground">{formatDate(row.date)}</td>
                  {crossLoan && (
                    <td className="whitespace-nowrap px-cell">
                      {loanLink(row)}
                      {row.loan && <div className="mt-0.5"><StatusBadge status={row.loan.loanStatus} domain="loan" inTable /></div>}
                    </td>
                  )}
                  {crossLoan && <td className="max-w-48 truncate px-cell text-foreground">{row.loan?.customerName}</td>}
                  {crossLoan && <td className="id-mono hidden whitespace-nowrap px-cell xl:table-cell">{formatRegNo(row.loan?.vehicleRegNo)}</td>}
                  <td className="px-cell"><StatusBadge status={row.direction} /></td>
                  <td className="px-cell">
                    <span className="text-foreground">{counterpartyLabel(row.counterparty)}</span>
                    {row.particular && <span className="block text-caption text-muted-foreground">{particularLabel(row.particular)}</span>}
                  </td>
                  <td className="hidden max-w-56 truncate px-cell text-muted-foreground lg:table-cell">{reference(row)}</td>
                  <td className="num whitespace-nowrap px-cell text-right font-medium text-success">{row.credit != null ? formatINR(row.credit) : ''}</td>
                  <td className="num whitespace-nowrap px-cell text-right font-medium text-danger">{row.debit != null ? formatINR(row.debit) : ''}</td>
                  <td className="num whitespace-nowrap px-cell text-right"><BalanceCell row={row} /></td>
                </tr>
                {open && (
                  <tr className="bg-muted/40">
                    <td />
                    <td colSpan={colCount - 1} className="px-cell pb-3 pt-1">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                        <div><dt className="text-caption text-muted-foreground">Mode of payment</dt><dd>{row.mode ? humanize(row.mode) : EMPTY}</dd></div>
                        <div><dt className="text-caption text-muted-foreground">Bank</dt><dd>{row.bank || EMPTY}</dd></div>
                        <div><dt className="text-caption text-muted-foreground">Account no</dt><dd className="id-mono">{row.accountNo || EMPTY}</dd></div>
                        <div><dt className="text-caption text-muted-foreground">Transaction ID</dt><dd className="id-mono break-all">{row.txnId || EMPTY}</dd></div>
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="h-row border-t-2 bg-muted/40 font-semibold">
            <td />
            <td colSpan={colCount - 4} className="px-cell text-foreground">{closing == null ? 'Total' : 'Total · closing balance'}</td>
            <td className="num whitespace-nowrap px-cell text-right text-success">{formatINR(totals.credit)}</td>
            <td className="num whitespace-nowrap px-cell text-right text-danger">{formatINR(totals.debit)}</td>
            <td className={cn('num whitespace-nowrap px-cell text-right', closing != null && closing < 0 ? 'text-danger' : 'text-foreground')}>{formatINR(closing)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

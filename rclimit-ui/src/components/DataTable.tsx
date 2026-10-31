import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { SortDir } from '@/hooks/useListState';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/choice';
import { EmptyState, ProgressBar, Skeleton } from '@/components/ui/feedback';
import { ActionMenu, DropdownMenu, MenuContent, type MenuAction } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';

// §8.6 DataTable: server-mode contract (the API owns search, sort and paging), desktop table, mobile cards from
// column roles, loading/empty/error states, totals, selection and row actions.

export interface ColumnDef<T> {
  id: string;
  header: string;
  cell?: (row: T) => ReactNode;
  // Field name sent to the server when the column is sortable.
  sortKey?: string;
  align?: 'start' | 'end';
  // Amounts and numbers align end and use tabular figures; ids use the mono font.
  kind?: 'text' | 'currency' | 'date' | 'id' | 'status' | 'number';
  // 1 = always shown; 2 hidden below lg; 3 hidden below xl.
  priority?: 1 | 2 | 3;
  // Role in the mobile card.
  mobile?: 'title' | 'subtitle' | 'badge' | 'meta' | 'hidden';
  // Footer total for this column (already formatted).
  total?: ReactNode;
  // Can the user hide it from the column menu?
  hideable?: boolean;
  className?: string;
}

export interface SortState {
  sortBy: string;
  sortDir: SortDir;
  onSort: (key: string) => void;
  // Mobile "Sort:" select options; defaults to sortable columns.
  options?: { value: string; label: string; dir: SortDir }[];
  onSortChange?: (key: string, dir: SortDir) => void;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[] | null | undefined;
  getRowId: (row: T) => string;
  label: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // The primary column links here (a real link, F18) and the whole row is a click target.
  rowHref?: (row: T) => string;
  // Alternative to rowHref (split view selection).
  onRowClick?: (row: T) => void;
  selectedId?: string | null;
  // Rows that need attention get a 3 px danger stripe (§6.3).
  rowAttention?: (row: T) => boolean;
  // Rows whose balance doesn't move are muted (ledger), etc.
  rowClassName?: (row: T) => string | undefined;
  sort?: SortState;
  empty: { title: string; description?: ReactNode; action?: ReactNode };
  isFiltered?: boolean;
  onClearFilters?: () => void;
  rowActions?: (row: T) => MenuAction[];
  mobileActions?: (row: T) => ReactNode;
  selection?: { selected: Set<string>; onChange: (selected: Set<string>) => void };
  bulkBar?: ReactNode;
  footer?: ReactNode;
  // localStorage key for hidden columns.
  columnsKey?: string;
  // Keyboard ↑/↓ moves selection (split view).
  onMove?: (row: T) => void;
  dense?: boolean;
  // Mobile "Load more": keep earlier pages while the view (everything except page) is unchanged.
  accumulate?: { page: number; viewKey: string };
}

const isEnd = (c: ColumnDef<unknown>) => c.align === 'end' || c.kind === 'currency' || c.kind === 'number';

function readHidden(key: string | undefined): string[] {
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(`rcl.cols.${key}`) ?? '[]');
  } catch {
    return [];
  }
}

function cellClass(col: ColumnDef<unknown>) {
  return cn(
    'px-cell',
    isEnd(col) && 'text-right num',
    col.kind === 'date' && 'num whitespace-nowrap',
    col.kind === 'id' && 'id-mono whitespace-nowrap',
    col.priority === 2 && 'hidden lg:table-cell',
    col.priority === 3 && 'hidden xl:table-cell',
    col.className,
  );
}

export default function DataTable<T>(props: DataTableProps<T>) {
  const {
    columns, rows, getRowId, label, loading, error, onRetry, rowHref, onRowClick, selectedId, rowAttention, rowClassName,
    sort, empty, isFiltered, onClearFilters, rowActions, mobileActions, selection, bulkBar, footer, columnsKey, onMove, dense, accumulate,
  } = props;
  const isMobile = useIsMobile();
  const [hidden, setHidden] = useState<string[]>(() => readHidden(columnsKey));
  const visibleColumns = columns.filter((c) => !hidden.includes(c.id));

  // Mobile "Load more" accumulation.
  const [accumulated, setAccumulated] = useState<T[]>([]);
  const lastView = useRef<string | null>(null);
  useEffect(() => {
    if (!accumulate || !rows) return;
    if (lastView.current !== accumulate.viewKey || accumulate.page === 1) {
      lastView.current = accumulate.viewKey;
      setAccumulated(rows);
    } else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map(getRowId));
        return [...prev, ...rows.filter((r) => !seen.has(getRowId(r)))];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, accumulate?.page, accumulate?.viewKey]);
  const displayRows = useMemo(() => (isMobile && accumulate ? accumulated : rows ?? []), [isMobile, accumulate, accumulated, rows]);

  const firstLoad = loading && !rows;
  const refetching = loading && !!rows;
  const hasTotals = visibleColumns.some((c) => c.total !== undefined);
  const hasActions = !!rowActions;
  const colCount = visibleColumns.length + (selection ? 1 : 0) + (hasActions ? 1 : 0);

  const toggleHidden = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    if (columnsKey) {
      try {
        localStorage.setItem(`rcl.cols.${columnsKey}`, JSON.stringify(next));
      } catch {
        // Not persisted.
      }
    }
  };

  const allIds = useMemo(() => displayRows.map(getRowId), [displayRows, getRowId]);
  const allSelected = selection && allIds.length > 0 && allIds.every((id) => selection.selected.has(id));
  const someSelected = selection && allIds.some((id) => selection.selected.has(id));

  const onTableKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    if (!onMove || displayRows.length === 0) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = displayRows.findIndex((r) => getRowId(r) === selectedId);
    const next = e.key === 'ArrowDown' ? Math.min(displayRows.length - 1, idx + 1) : Math.max(0, idx - 1);
    onMove(displayRows[next]);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-id="${getRowId(displayRows[next])}"] [data-primary-link]`)?.focus());
  };

  const stateBody = (() => {
    if (error) {
      return (
        <Alert tone="danger" title="This list didn't load" action={onRetry && <Button variant="outline" size="sm" icon={RotateCw} onClick={onRetry}>Retry</Button>} className="m-4">
          {error}
        </Alert>
      );
    }
    if (!loading && displayRows.length === 0) {
      return isFiltered ? (
        <EmptyState
          variant="no-results"
          title={`No ${label.toLowerCase()} match these filters`}
          description="Try other filters, or clear them to see everything."
          action={onClearFilters && <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>}
        />
      ) : (
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
      );
    }
    return null;
  })();

  const primaryColumn = visibleColumns.find((c) => c.mobile === 'title') ?? visibleColumns[0];

  const renderPrimary = (row: T, col: ColumnDef<T>) => {
    const content = col.cell ? col.cell(row) : null;
    if (rowHref) {
      return (
        <Link
          to={rowHref(row)}
          data-primary-link
          className="font-medium text-foreground after:absolute after:inset-0 hover:underline focus-visible:outline-none"
          onClick={(e) => {
            if (onRowClick && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
              e.preventDefault();
              onRowClick(row);
            }
          }}
        >
          {content}
        </Link>
      );
    }
    if (onRowClick) {
      return (
        <button type="button" data-primary-link onClick={() => onRowClick(row)} className="text-left font-medium text-foreground after:absolute after:inset-0 hover:underline focus-visible:outline-none">
          {content}
        </button>
      );
    }
    return content;
  };

  // ---------- Mobile: stacked cards ----------
  if (isMobile) {
    const sortOptions = sort?.options ?? columns.filter((c) => c.sortKey).flatMap((c) => [
      { value: `${c.sortKey}:desc`, label: `${c.header}, descending`, dir: 'desc' as SortDir },
      { value: `${c.sortKey}:asc`, label: `${c.header}, ascending`, dir: 'asc' as SortDir },
    ]);
    const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
    const subtitle = columns.filter((c) => c.mobile === 'subtitle');
    const badge = columns.filter((c) => c.mobile === 'badge');
    const meta = columns.filter((c) => c.mobile === 'meta');

    return (
      <div className="space-y-3" aria-busy={loading || undefined}>
        {bulkBar}
        {sort && sortOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-caption text-muted-foreground">Sort</span>
            <Select
              aria-label="Sort by"
              value={`${sort.sortBy}:${sort.sortDir}`}
              onValueChange={(v) => {
                const [key, dir] = v.split(':');
                if (sort.onSortChange) sort.onSortChange(key, dir as SortDir);
                else sort.onSort(key);
              }}
              options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
              className="h-9 flex-1"
            />
          </div>
        )}
        {firstLoad && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        {stateBody && <div className="rounded-lg border bg-surface">{stateBody}</div>}
        <ul className={cn('space-y-2', refetching && 'opacity-60')}>
          {!firstLoad && displayRows.map((row) => {
            const id = getRowId(row);
            const actions = mobileActions?.(row);
            return (
              <li
                key={id}
                data-row-id={id}
                className={cn(
                  'relative rounded-lg border bg-surface p-4 shadow-xs',
                  rowAttention?.(row) && 'border-l-[3px] border-l-danger',
                  selectedId === id && 'border-primary bg-primary-subtle',
                  rowClassName?.(row),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{renderPrimary(row, title)}</div>
                    {subtitle.length > 0 && (
                      <p className="mt-0.5 truncate text-caption text-muted-foreground">
                        {subtitle.map((c, i) => <span key={c.id}>{i > 0 && ' · '}<span className={cn(c.kind === 'id' && 'id-mono')}>{c.cell?.(row)}</span></span>)}
                      </p>
                    )}
                  </div>
                  {badge.length > 0 && <div className="relative z-10 flex shrink-0 flex-col items-end gap-1">{badge.map((c) => <div key={c.id}>{c.cell?.(row)}</div>)}</div>}
                </div>
                {meta.length > 0 && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {meta.map((c) => (
                      <div key={c.id} className="min-w-0">
                        <dt className="text-caption text-muted-foreground">{c.header}</dt>
                        <dd className={cn('truncate text-sm text-foreground', (c.kind === 'currency' || c.kind === 'number' || c.kind === 'date') && 'num', c.kind === 'id' && 'id-mono')}>{c.cell?.(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {(actions || rowActions) && (
                  <div className="relative z-10 mt-3 flex items-center justify-end gap-2 border-t pt-3">
                    {actions}
                    {rowActions && <ActionMenu actions={rowActions(row)} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {footer}
      </div>
    );
  }

  // ---------- Desktop: table ----------
  const hideable = columns.filter((c) => c.hideable);

  return (
    <div className="space-y-3">
      {bulkBar}
      <div className="relative overflow-hidden rounded-lg border bg-surface">
        {hideable.length > 0 && (
          <div className="absolute right-1 top-1 z-sticky">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Choose columns"><Columns3 /></Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <MenuContent>
                  <p className="px-2 py-1.5 text-label text-muted-foreground">Columns</p>
                  {hideable.map((c) => (
                    <DropdownMenu.CheckboxItem
                      key={c.id}
                      checked={!hidden.includes(c.id)}
                      onCheckedChange={() => toggleHidden(c.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
                    >
                      <span className={cn('flex size-4 items-center justify-center rounded border', !hidden.includes(c.id) && 'border-primary bg-primary text-primary-foreground')}>
                        {!hidden.includes(c.id) && '✓'}
                      </span>
                      {c.header}
                    </DropdownMenu.CheckboxItem>
                  ))}
                </MenuContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label={label} aria-busy={loading || undefined}>
            <thead className="sticky top-0 z-sticky bg-muted">
              <tr>
                {selection && (
                  <th scope="col" className="w-10 pl-cell">
                    <Checkbox
                      aria-label="Select all rows on this page"
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={(checked) => {
                        const next = new Set(selection.selected);
                        allIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
                        selection.onChange(next);
                      }}
                    />
                  </th>
                )}
                {visibleColumns.map((col) => {
                  const active = sort && col.sortKey && sort.sortBy === col.sortKey;
                  const ariaSort = active ? (sort!.sortDir === 'asc' ? 'ascending' : 'descending') : col.sortKey ? 'none' : undefined;
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn('h-10 whitespace-nowrap text-left text-label font-medium text-muted-foreground', cellClass(col as ColumnDef<unknown>))}
                    >
                      {sort && col.sortKey ? (
                        <button
                          type="button"
                          onClick={() => sort.onSort(col.sortKey!)}
                          className={cn('inline-flex items-center gap-1 font-sans hover:text-foreground', isEnd(col as ColumnDef<unknown>) && 'flex-row-reverse')}
                        >
                          {col.header}
                          {active ? (sort.sortDir === 'asc' ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />) : <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />}
                        </button>
                      ) : <span className="font-sans">{col.header}</span>}
                    </th>
                  );
                })}
                {hasActions && <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>}
              </tr>
              <tr aria-hidden>
                <th colSpan={colCount} className="p-0"><ProgressBar active={!!refetching} /></th>
              </tr>
            </thead>
            <tbody onKeyDown={onTableKeyDown} className={cn('divide-y', refetching && 'opacity-60 transition-opacity')}>
              {firstLoad && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="h-row">
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} className="px-cell"><Skeleton className={cn('h-4', j === 0 ? 'w-32' : 'w-20')} /></td>
                  ))}
                </tr>
              ))}
              {stateBody && (
                <tr><td colSpan={colCount}>{stateBody}</td></tr>
              )}
              {!firstLoad && !error && displayRows.map((row) => {
                const id = getRowId(row);
                const selected = selectedId === id;
                const clickable = !!(rowHref || onRowClick);
                return (
                  <tr
                    key={id}
                    data-row-id={id}
                    aria-selected={selectedId !== undefined ? selected : undefined}
                    className={cn(
                      'relative transition-colors duration-[120ms]',
                      dense ? 'h-9' : 'h-row',
                      clickable && 'cursor-pointer hover:bg-muted/60 focus-within:bg-muted/60',
                      selected && 'bg-primary-subtle hover:bg-primary-subtle',
                      rowClassName?.(row),
                    )}
                    style={selected ? { boxShadow: 'inset 3px 0 0 var(--primary)' } : rowAttention?.(row) ? { boxShadow: 'inset 3px 0 0 var(--danger)' } : undefined}
                  >
                    {selection && (
                      <td className="relative z-10 w-10 pl-cell">
                        <Checkbox
                          aria-label="Select row"
                          checked={selection.selected.has(id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selection.selected);
                            if (checked) next.add(id);
                            else next.delete(id);
                            selection.onChange(next);
                          }}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td key={col.id} className={cn('whitespace-nowrap text-foreground', cellClass(col as ColumnDef<unknown>))}>
                        {col === primaryColumn && clickable ? renderPrimary(row, col) : col.cell ? col.cell(row) : null}
                      </td>
                    ))}
                    {hasActions && (
                      <td className="relative z-10 w-12 pr-2 text-right">
                        <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [tr:hover_&]:opacity-100 pointer-coarse:opacity-100">
                          <ActionMenu actions={rowActions!(row)} label="Row actions" />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {hasTotals && !firstLoad && displayRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  {selection && <td />}
                  {visibleColumns.map((col, i) => (
                    <td key={col.id} className={cn('h-row whitespace-nowrap text-foreground', cellClass(col as ColumnDef<unknown>))}>
                      {i === 0 && col.total === undefined ? 'Total' : col.total}
                    </td>
                  ))}
                  {hasActions && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {footer}
    </div>
  );
}

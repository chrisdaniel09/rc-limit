import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PageMeta } from '@/hooks/useFetch';
import { PAGE_SIZE_OPTIONS } from '@/hooks/useListState';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface PaginationProps {
  meta: PageMeta | null;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
  // Rows already shown on mobile (accumulated by "Load more").
  shownCount?: number;
}

// Page numbers with ellipsis: 1 … 4 5 6 … 17.
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

// §8.9: desktop "1–25 of 412 ‹ 1 2 3 … 17 › 25 / page"; mobile "Load more (25 of 412)".
export default function Pagination({ meta, pageSize, onPageChange, onPageSizeChange, loading, shownCount }: PaginationProps) {
  const isMobile = useIsMobile();

  // A page past the end (for example after the last record on it was removed) falls back to the last page.
  useEffect(() => {
    if (meta && meta.totalPages > 0 && meta.page > meta.totalPages) onPageChange(meta.totalPages);
  }, [meta, onPageChange]);

  if (!meta || meta.totalCount === 0) return null;
  const { page, totalPages, totalCount } = meta;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const count = totalCount.toLocaleString('en-IN');

  if (isMobile) {
    const shown = shownCount ?? to;
    if (page >= totalPages) {
      return <p className="num py-2 text-center text-caption text-muted-foreground">Showing all {count}</p>;
    }
    return (
      <Button variant="outline" className="w-full" loading={loading} onClick={() => onPageChange(page + 1)}>
        Load more <span className="num text-muted-foreground">({shown.toLocaleString('en-IN')} of {count})</span>
      </Button>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p className="num" aria-live="polite">{from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')} of {count}</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</Button>
        {pageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} aria-hidden className="px-1">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              onClick={() => onPageChange(p)}
              className={cn('num h-7 min-w-7 rounded-md px-1.5 text-sm transition-colors', p === page ? 'bg-primary-subtle font-semibold text-primary' : 'text-foreground hover:bg-muted')}
            >
              {p}
            </button>
          ),
        )}
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next <ChevronRight aria-hidden />
        </Button>
      </div>
      <Select
        aria-label="Rows per page"
        value={String(pageSize)}
        onValueChange={(v) => onPageSizeChange(Number(v))}
        options={PAGE_SIZE_OPTIONS.map((s) => ({ value: String(s), label: `${s} / page` }))}
        className="h-8 w-28"
      />
    </nav>
  );
}

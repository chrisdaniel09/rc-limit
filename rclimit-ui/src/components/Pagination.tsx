import { useEffect } from 'react';
import type { PageMeta } from '../hooks/useFetch';
import { PAGE_SIZE_OPTIONS } from '../hooks/useListState';

interface PaginationProps {
  meta: PageMeta | null;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const buttonClass = 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

export default function Pagination({ meta, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  // A page past the end (for example after the last record on it was removed) falls back to the last page.
  useEffect(() => {
    if (meta && meta.totalPages > 0 && meta.page > meta.totalPages) {
      onPageChange(meta.totalPages);
    }
  }, [meta, onPageChange]);

  if (!meta) return null;

  const { page, totalPages, totalCount } = meta;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
      <p>
        {totalCount === 0 ? 'No records' : `${from}–${to} of ${totalCount}`}
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => onPageChange(1)} disabled={isFirst}>
          First
        </button>
        <button type="button" className={buttonClass} onClick={() => onPageChange(page - 1)} disabled={isFirst}>
          Previous
        </button>
        <span className="px-2">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button type="button" className={buttonClass} onClick={() => onPageChange(page + 1)} disabled={isLast}>
          Next
        </button>
        <button type="button" className={buttonClass} onClick={() => onPageChange(totalPages)} disabled={isLast}>
          Last
        </button>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Records per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size} / page</option>
          ))}
        </select>
      </div>
    </div>
  );
}

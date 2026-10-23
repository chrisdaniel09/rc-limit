import { useState, useCallback, useRef } from 'react';
import { buildQuery } from '../utils/query';

export type SortDir = 'asc' | 'desc';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

// Page size is a per-viewer convenience, so storage failures (private mode, blocked storage) are ignored.
function readPageSize(storageKey: string): number {
  try {
    const stored = Number(localStorage.getItem(storageKey));
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function writePageSize(storageKey: string, size: number): void {
  try {
    localStorage.setItem(storageKey, String(size));
  } catch {
    // Not persisted; the page still works.
  }
}

interface ListStateOptions<F extends Record<string, string>> {
  storageKey: string;
  defaultSortBy: string;
  defaultSortDir: SortDir;
  initialFilters: F;
}

/**
 * Paging, search, sort and filter state for a server-paged list.
 * Any change other than the page itself returns to page 1, so a filtered or sorted list never lands past its end.
 * Pass `query` into the list URL; useFetch refetches whenever that URL changes.
 */
export function useListState<F extends Record<string, string>>({
  storageKey,
  defaultSortBy,
  defaultSortDir,
  initialFilters,
}: ListStateOptions<F>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(() => readPageSize(storageKey));
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [searchInput, setSearchInputState] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<F>(initialFilters);

  // Debounced so typing does not fire a request per keystroke. The timer is cleared on each keystroke.
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const updateFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }, []);

  const updateSort = useCallback((key: string) => {
    if (key === sortBy) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortBy]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    writePageSize(storageKey, size);
    setPage(1);
  }, [storageKey]);

  const query = buildQuery({ page, pageSize, sortBy, sortDir, search, ...filters });

  return {
    query,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    sortDir,
    updateSort,
    searchInput,
    setSearchInput,
    filters,
    updateFilter,
  };
}

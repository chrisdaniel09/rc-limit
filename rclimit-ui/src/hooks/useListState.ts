import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

// URL keys owned by the list itself; every other key is a filter, the split selection or a tab.
const RESERVED = new Set(['q', 'sort', 'dir', 'page', 'size', 'id', 'tab', 'new']);

interface ListStateOptions<F extends Record<string, string>> {
  storageKey: string;
  defaultSortBy: string;
  defaultSortDir: SortDir;
  initialFilters: F;
}

/**
 * Paging, search, sort and filter state for a server-paged list, kept in the URL (§11.5) so a view can be shared,
 * survives refresh, and back/forward restores it. Page size defaults from localStorage.
 * Any change other than the page itself returns to page 1, so a filtered or sorted list never lands past its end.
 * Pass `query` into the list URL; useFetch refetches whenever that URL changes.
 */
export function useListState<F extends Record<string, string>>({
  storageKey,
  defaultSortBy,
  defaultSortDir,
  initialFilters,
}: ListStateOptions<F>) {
  const [params, setParams] = useSearchParams();
  const [defaultSize, setDefaultSize] = useState(() => readPageSize(storageKey));

  const page = Math.max(1, Number(params.get('page')) || 1);
  const sizeParam = Number(params.get('size'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : defaultSize;
  const sortBy = params.get('sort') ?? defaultSortBy;
  const sortDir: SortDir = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : defaultSortDir;
  const search = params.get('q') ?? '';

  const filterKeys = useMemo(() => Object.keys(initialFilters), [initialFilters]);
  const filters = useMemo(() => {
    const next = { ...initialFilters };
    for (const key of filterKeys) {
      const v = params.get(key);
      if (v !== null) (next as Record<string, string>)[key] = v;
    }
    return next;
  }, [params, filterKeys, initialFilters]);

  const update = useCallback((changes: Record<string, string | number | null>, resetPage = true) => {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') p.delete(key);
        else p.set(key, String(value));
      }
      if (resetPage && !('page' in changes)) p.delete('page');
      return p;
    }, { replace: true });
  }, [setParams]);

  // The search box updates at once; the URL (and so the request) after a pause in typing.
  const [searchInput, setSearchInputState] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!searchTimer.current) setSearchInputState(search);
  }, [search]);
  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      update({ q: value.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
  }, [update]);

  const setPage = useCallback((next: number) => update({ page: next <= 1 ? null : next }, false), [update]);

  const updateFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    const initial = initialFilters[key];
    update({ [key as string]: value === initial ? null : value });
  }, [update, initialFilters]);

  const setFilters = useCallback((next: Partial<F>) => {
    const changes: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(next)) changes[key] = value === initialFilters[key] ? null : (value as string);
    update(changes);
  }, [update, initialFilters]);

  const clearFilters = useCallback(() => {
    const changes: Record<string, null> = { q: null };
    for (const key of filterKeys) changes[key] = null;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    setSearchInputState('');
    update(changes);
  }, [filterKeys, update]);

  const updateSort = useCallback((key: string) => {
    if (key === sortBy) update({ sort: key, dir: sortDir === 'asc' ? 'desc' : 'asc' });
    else update({ sort: key, dir: 'asc' });
  }, [sortBy, sortDir, update]);

  const setSort = useCallback((key: string, dir: SortDir) => update({ sort: key, dir }), [update]);

  const setPageSize = useCallback((size: number) => {
    setDefaultSize(size);
    writePageSize(storageKey, size);
    update({ size: null });
  }, [storageKey, update]);

  const activeFilterCount = filterKeys.filter((k) => filters[k] !== initialFilters[k]).length;
  const isFiltered = activeFilterCount > 0 || search !== '';

  const query = buildQuery({ page, pageSize, sortBy, sortDir, search, ...filters });
  // Everything but the page: lets mobile "Load more" know when to start over.
  const viewKey = buildQuery({ pageSize, sortBy, sortDir, search, ...filters });

  // Split-view selection (§7.3 T2).
  const selectedId = params.get('id');
  const setSelectedId = useCallback((id: string | null) => update({ id }, false), [update]);

  // Restores a whole view (saved views, §8.8).
  const applyView = useCallback((view: { q?: string; sort?: string; dir?: SortDir; filters?: Partial<F> }) => {
    const changes: Record<string, string | null> = { q: view.q || null, sort: view.sort ?? null, dir: view.dir ?? null };
    for (const key of filterKeys) {
      const v = view.filters?.[key];
      changes[key] = v == null || v === initialFilters[key] ? null : v;
    }
    setSearchInputState(view.q ?? '');
    update(changes);
  }, [filterKeys, initialFilters, update]);

  return {
    query,
    viewKey,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    sortDir,
    updateSort,
    setSort,
    search,
    searchInput,
    setSearchInput,
    filters,
    updateFilter,
    setFilters,
    clearFilters,
    activeFilterCount,
    isFiltered,
    selectedId,
    setSelectedId,
    applyView,
    params,
    reserved: RESERVED,
  };
}

export type ListState<F extends Record<string, string>> = ReturnType<typeof useListState<F>>;

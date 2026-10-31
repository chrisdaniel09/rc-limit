import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../api/client';
import type { ResourceAction } from '../components/ActionButton';

export interface HateoasLink {
  href: string;
  rel: string;
  method: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  // Aggregates over the whole filter, when the endpoint sends them (§15-6).
  totals?: Record<string, number> | null;
}

interface Unwrapped<T> {
  data: T;
  links: HateoasLink[];
  actions: ResourceAction[] | null;
  meta: PageMeta | null;
}

function unwrapHateoas<T>(raw: unknown): Unwrapped<T> {
  if (raw && typeof raw === 'object' && 'data' in raw && ('links' in raw || 'meta' in raw || 'actions' in raw)) {
    const h = raw as { data: T; links?: HateoasLink[]; actions?: ResourceAction[]; meta?: PageMeta };
    return { data: h.data, links: h.links ?? [], actions: h.actions ?? null, meta: h.meta ?? null };
  }
  return { data: raw as T, links: [], actions: null, meta: null };
}

interface FetchOptions {
  // Refetch when the window regains focus and the data is older than this (ms). §11.7: detail 60 s, lists 5 min.
  staleAfter?: number;
}

/**
 * Loads `url` (skipped when null or empty). Keeps the previous data while refetching so screens don't flash.
 */
export function useFetch<T>(url: string | null, deps: unknown[] = [], options: FetchOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [links, setLinks] = useState<HateoasLink[]>([]);
  const [actions, setActions] = useState<ResourceAction[] | null>(null);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // Only the most recent request may update state. Without this, a slow earlier response
  // (for example, before a filter or page change) could overwrite the newer result.
  const latestRequest = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequest.current;
    if (!url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = await apiGet<unknown>(url);
      if (requestId !== latestRequest.current) return;
      const unwrapped = unwrapHateoas<T>(raw);
      setData(unwrapped.data);
      setLinks(unwrapped.links);
      setActions(unwrapped.actions);
      setMeta(unwrapped.meta);
      setFetchedAt(Date.now());
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchedAtRef = useRef(fetchedAt);
  fetchedAtRef.current = fetchedAt;
  useEffect(() => {
    const staleAfter = options.staleAfter;
    if (!staleAfter || !url) return;
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      if (fetchedAtRef.current && Date.now() - fetchedAtRef.current > staleAfter) void fetchData();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [options.staleAfter, url, fetchData]);

  return { data, links, actions, meta, loading, error, refetch: fetchData, fetchedAt };
}

export const DETAIL_STALE_MS = 60_000;
export const LIST_STALE_MS = 5 * 60_000;

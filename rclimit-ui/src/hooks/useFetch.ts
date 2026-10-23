import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../api/client';

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
}

interface Unwrapped<T> {
  data: T;
  links: HateoasLink[];
  meta: PageMeta | null;
}

function unwrapHateoas<T>(raw: unknown): Unwrapped<T> {
  if (raw && typeof raw === 'object' && 'data' in raw && 'links' in raw) {
    const h = raw as { data: T; links: HateoasLink[]; meta?: PageMeta };
    return { data: h.data, links: h.links ?? [], meta: h.meta ?? null };
  }
  return { data: raw as T, links: [], meta: null };
}

export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [links, setLinks] = useState<HateoasLink[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the most recent request may update state. Without this, a slow earlier response
  // (for example, before a filter or page change) could overwrite the newer result.
  const latestRequest = useRef(0);

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const raw = await apiGet<unknown>(url);
      if (requestId !== latestRequest.current) return;
      const { data: unwrapped, links: hateoasLinks, meta: pageMeta } = unwrapHateoas<T>(raw);
      setData(unwrapped);
      setLinks(hateoasLinks);
      setMeta(pageMeta);
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

  return { data, links, meta, loading, error, refetch: fetchData };
}

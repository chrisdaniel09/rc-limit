import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api/client';

export interface HateoasLink {
  href: string;
  rel: string;
  method: string;
}

function unwrapHateoas<T>(raw: unknown): { data: T; links: HateoasLink[] } {
  if (raw && typeof raw === 'object' && 'data' in raw && 'links' in raw) {
    const h = raw as { data: T; links: HateoasLink[] };
    return { data: h.data, links: h.links ?? [] };
  }
  return { data: raw as T, links: [] };
}

export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [links, setLinks] = useState<HateoasLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiGet<unknown>(url);
      const { data: unwrapped, links: hateoasLinks } = unwrapHateoas<T>(raw);
      setData(unwrapped);
      setLinks(hateoasLinks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, links, loading, error, refetch: fetchData };
}

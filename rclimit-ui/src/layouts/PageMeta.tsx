import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useMatches } from 'react-router-dom';
import type { RouteHandle } from '@/App';
import { useTheme } from '@/theme/ThemeProvider';

// Detail pages name their record ("LN-2026-00412") so the breadcrumb and document.title show it (§7.2).

interface PageMetaValue {
  recordTitle: string | null;
  setRecordTitle: (title: string | null) => void;
}

const PageMetaContext = createContext<PageMetaValue | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
  const [recordTitle, setRecordTitle] = useState<string | null>(null);
  return <PageMetaContext.Provider value={{ recordTitle, setRecordTitle }}>{children}</PageMetaContext.Provider>;
}

export function useRecordTitle(title: string | null | undefined) {
  const ctx = useContext(PageMetaContext);
  useEffect(() => {
    ctx?.setRecordTitle(title ?? null);
    return () => ctx?.setRecordTitle(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}

export interface Crumb {
  label: string;
  to?: string;
}

export function useBreadcrumbs(): { crumbs: Crumb[]; title: string } {
  const ctx = useContext(PageMetaContext);
  const matches = useMatches();
  const match = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title);
  const handle = match?.handle as RouteHandle | undefined;
  const pageTitle = handle?.title ?? '';
  const title = ctx?.recordTitle ?? pageTitle;
  const crumbs: Crumb[] = [...(handle?.trail ?? []), { label: title }];
  return { crumbs, title };
}

// Keeps document.title as "{page} · {brand}".
export function DocumentTitle() {
  const { title } = useBreadcrumbs();
  const { brand } = useTheme();
  useEffect(() => {
    document.title = title ? `${title} · ${brand.name}` : brand.name;
  }, [title, brand.name]);
  return null;
}

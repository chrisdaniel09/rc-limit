import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiBaseUrl } from '@/config';
import { apiGet } from '@/api/client';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DEFAULT_UTILIZATION_THRESHOLDS } from '@/lib/status';
import {
  applyFavicon, applyThemeCss, DEFAULT_TERMINOLOGY, PLATFORM_THEME, readCachedTheme, readPreference, safeImageUrl,
  writeCachedTheme, writePreference, type ColorMode, type Density, type TenantTheme, type Terminology,
} from '@/lib/theme';

// §3.7 ThemeProvider: tenant brand, color mode, density and tenant terminology/thresholds.

const COLOR_MODES = ['light', 'dark', 'system'] as const;
const DENSITIES = ['comfortable', 'compact'] as const;

export interface Brand {
  name: string;
  shortName: string;
  logo: string | null;
  logoMark: string | null;
  loginBackground: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
}

interface ThemeContextValue {
  brand: Brand;
  colorMode: ColorMode;
  resolvedMode: 'light' | 'dark';
  setColorMode: (mode: ColorMode) => void;
  density: Density;
  setDensity: (density: Density) => void;
  terms: Terminology;
  thresholds: { warnPct: number; dangerPct: number };
  // Loads the signed-in tenant settings (thresholds). Called by the app shell after sign-in.
  loadTenantSettings: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface TenantSettingsResponse {
  subLimitWarnPct?: number | null;
  subLimitDangerPct?: number | null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<TenantTheme>(() => readCachedTheme() ?? PLATFORM_THEME);
  const [colorMode, setColorModeState] = useState<ColorMode>(
    () => readPreference('rcl.colorMode', COLOR_MODES) ?? theme.defaults?.colorMode ?? 'system',
  );
  const [density, setDensityState] = useState<Density>(
    () => readPreference('rcl.density', DENSITIES) ?? theme.defaults?.density ?? 'comfortable',
  );
  const [thresholds, setThresholds] = useState(DEFAULT_UTILIZATION_THRESHOLDS);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedMode = colorMode === 'system' ? (prefersDark ? 'dark' : 'light') : colorMode;

  // Fetch the tenant theme in the background; the cached or platform theme is already on screen (§3.7).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/tenant/theme`, { credentials: 'include' });
        if (!res.ok) return;
        const body = await res.json();
        const next = (body?.data ?? body) as TenantTheme;
        if (cancelled || !next?.brand) return;
        setTheme((current) => (current.version === next.version && current.brand.name === next.brand.name ? current : next));
        writeCachedTheme(next);
      } catch {
        // Keep the cached or platform theme.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeCss(theme);
    applyFavicon(safeImageUrl(theme.brand.favicon));
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedMode === 'dark');
    root.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    writePreference('rcl.colorMode', mode);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    writePreference('rcl.density', next);
  }, []);

  const loadTenantSettings = useCallback(() => {
    apiGet<{ data?: TenantSettingsResponse } & TenantSettingsResponse>('/api/v1/tenant/settings')
      .then((raw) => {
        const s = raw?.data ?? raw;
        const warn = s?.subLimitWarnPct ?? DEFAULT_UTILIZATION_THRESHOLDS.warnPct;
        const danger = s?.subLimitDangerPct ?? DEFAULT_UTILIZATION_THRESHOLDS.dangerPct;
        if (warn > 0 && danger > warn && danger <= 100) setThresholds({ warnPct: warn, dangerPct: danger });
      })
      .catch(() => {
        // Keep the 70 / 90 defaults.
      });
  }, []);

  const brand = useMemo<Brand>(() => {
    const logo = theme.brand.logo;
    return {
      name: theme.brand.name || PLATFORM_THEME.brand.name,
      shortName: theme.brand.shortName || theme.brand.name?.slice(0, 2).toUpperCase() || 'RC',
      logo: safeImageUrl(resolvedMode === 'dark' ? logo?.dark ?? logo?.light : logo?.light ?? logo?.dark),
      logoMark: safeImageUrl(theme.brand.logoMark),
      loginBackground: safeImageUrl(theme.brand.loginBackground),
      supportEmail: theme.supportContact?.email ?? null,
      supportPhone: theme.supportContact?.phone ?? null,
    };
  }, [theme, resolvedMode]);

  const terms = useMemo<Terminology>(() => ({ ...DEFAULT_TERMINOLOGY, ...(theme.terminology ?? {}) }), [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ brand, colorMode, resolvedMode, setColorMode, density, setDensity, terms, thresholds, loadTenantSettings }),
    [brand, colorMode, resolvedMode, setColorMode, density, setDensity, terms, thresholds, loadTenantSettings],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export const useThresholds = () => useTheme().thresholds;
export const useTerms = () => useTheme().terms;

// Tenant theme document (docs/ui_ux_specification.md §3.5) and how it is applied to the page.
// The server validates the document when it serves it (§3.6); the client only refuses values that aren't plain
// colors or lengths, so a bad database edit can't inject CSS.

export type ColorMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

export interface TenantTheme {
  version: number;
  brand: {
    name: string;
    shortName?: string;
    logo?: { light?: string | null; dark?: string | null } | null;
    logoMark?: string | null;
    favicon?: string | null;
    loginBackground?: string | null;
  };
  tokens?: { light?: Record<string, string>; dark?: Record<string, string> };
  radius?: string | null;
  fonts?: { ui?: string | null; data?: string | null } | null;
  defaults?: { density?: Density; colorMode?: ColorMode } | null;
  terminology?: Partial<Terminology> | null;
  supportContact?: { email?: string | null; phone?: string | null } | null;
}

export interface Terminology {
  brokerLedgerName: string;
  brokerCounterpartyCode: string;
}

export const DEFAULT_TERMINOLOGY: Terminology = {
  brokerLedgerName: 'Broker balance',
  brokerCounterpartyCode: 'ANNA_FINANCE',
};

export const PLATFORM_THEME: TenantTheme = {
  version: 0,
  brand: { name: 'RC Limit', shortName: 'RC' },
  terminology: DEFAULT_TERMINOLOGY,
};

// Tokens a tenant may override (§3.3 ✎).
export const OVERRIDABLE_TOKENS = [
  'primary', 'primary-foreground', 'primary-subtle', 'ring', 'accent',
  'success', 'success-subtle', 'warning', 'warning-subtle', 'danger', 'danger-subtle', 'info', 'info-subtle',
  'sidebar', 'sidebar-foreground', 'sidebar-active',
] as const;

const FONT_ALLOW_LIST: Record<string, string> = {
  Inter: '"Inter Variable"',
  'JetBrains Mono': '"JetBrains Mono Variable"',
  'system-ui': 'system-ui',
};

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([0-9a-z.,%\s/+-]+\))$/i;
const SAFE_LENGTH = /^(0|\d{1,2}(\.\d+)?(px|rem))$/;

function tokenBlock(selector: string, tokens: Record<string, string> | undefined): string {
  if (!tokens) return '';
  const lines = OVERRIDABLE_TOKENS
    .filter((name) => typeof tokens[name] === 'string' && SAFE_COLOR.test(tokens[name].trim()))
    .map((name) => `--${name}:${tokens[name].trim()};`);
  return lines.length ? `${selector}{${lines.join('')}}` : '';
}

// CSS for the <style id="tenant-theme"> block.
export function themeCss(theme: TenantTheme): string {
  const root: string[] = [];
  if (theme.radius && SAFE_LENGTH.test(theme.radius)) root.push(`--radius:${theme.radius};`);
  const ui = theme.fonts?.ui && FONT_ALLOW_LIST[theme.fonts.ui];
  const data = theme.fonts?.data && FONT_ALLOW_LIST[theme.fonts.data];
  if (ui) root.push(`--font-ui:${ui};`);
  if (data) root.push(`--font-data:${data};`);
  return [
    root.length ? `:root{${root.join('')}}` : '',
    tokenBlock(':root', theme.tokens?.light),
    tokenBlock('.dark', theme.tokens?.dark),
  ].join('');
}

export function applyThemeCss(theme: TenantTheme): void {
  let el = document.getElementById('tenant-theme') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'tenant-theme';
    document.head.appendChild(el);
  }
  el.textContent = themeCss(theme);
}

// Only https images on the tenant's own asset folder reach the page; the server enforces the host (§3.5–3.6).
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === 'https:' || parsed.origin === window.location.origin) return parsed.href;
  } catch {
    // Not a URL.
  }
  return null;
}

export function applyFavicon(url: string | null): void {
  if (!url) return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

const storageKey = () => `rcl.theme.${window.location.host}`;

export function readCachedTheme(): TenantTheme | null {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? (JSON.parse(raw) as TenantTheme) : null;
  } catch {
    return null;
  }
}

export function writeCachedTheme(theme: TenantTheme): void {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(theme));
    // The boot script in index.html applies this before React loads, so there's no flash of the wrong brand.
    localStorage.setItem(`rcl.themeCss.${window.location.host}`, themeCss(theme));
  } catch {
    // Not cached; the next visit refetches.
  }
}

export function readPreference<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference lasts for this visit only.
  }
}

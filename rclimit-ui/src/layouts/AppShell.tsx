import { useEffect, useState, useSyncExternalStore } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/theme/ThemeProvider';
import { useCommandK, useShortcuts } from '@/hooks/useShortcuts';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { CommandPalette } from './CommandPalette';
import { DocumentTitle, PageMetaProvider } from './PageMeta';
import { MobileNav, Sidebar, useSidebarCollapsed } from './Sidebar';
import { Topbar } from './Topbar';
import { WORKSPACE } from './navigation';

// §7.1 app shell: sidebar, sticky topbar, page outlet; plus the command palette, global shortcuts and offline banner.

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl/⌘ K', 'Command palette: pages, records and actions'],
  ['/', 'Focus the list search'],
  ['g d · g l · g c · g o', 'Go to Dashboard · Leads · Customers · Loans'],
  ['n', 'New record on list pages'],
  ['↑ ↓ · Enter · Esc', 'Move, open and leave the selection in split view'],
  ['Ctrl/⌘ Enter', 'Submit a dialog or post a comment'],
  ['?', 'Show this help'],
];

export default function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const { loadTenantSettings } = useTheme();
  const navigate = useNavigate();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    loadTenantSettings();
  }, [loadTenantSettings]);

  useCommandK(() => setPaletteOpen((o) => !o));

  const go: Record<string, () => void> = {};
  WORKSPACE.filter((i) => i.goKey).forEach((i) => {
    go[`g ${i.goKey}`] = () => navigate(i.to);
  });
  useShortcuts({
    ...go,
    '?': () => setHelpOpen(true),
    '/': () => {
      const search = document.querySelector<HTMLInputElement>('[data-list-search]');
      search?.focus();
      search?.select();
    },
    n: () => document.querySelector<HTMLButtonElement>('[data-new-record]')?.click(),
  });

  return (
    <PageMetaProvider>
      <DocumentTitle />
      <a href="#main" className="sr-only z-tooltip rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-300 md:pl-16', !collapsed && 'lg:pl-60')}>
        <Topbar onMenuClick={() => setMobileNavOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        {!online && (
          <div role="status" className="flex items-center gap-2 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-sm text-foreground md:px-6">
            <WifiOff aria-hidden className="size-4 text-warning" />
            You're offline. Changes won't save until the connection is back.
          </div>
        )}
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-4 outline-none md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onShowShortcuts={() => setHelpOpen(true)} />
      <ResponsiveDialog open={helpOpen} onOpenChange={setHelpOpen} title="Keyboard shortcuts" size="md">
        <dl className="divide-y">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-muted-foreground">{desc}</dt>
              <dd><kbd className="whitespace-nowrap rounded border bg-muted px-1.5 py-0.5 font-sans text-caption">{keys}</kbd></dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-caption text-muted-foreground">Shortcuts are off while you're typing in a field.</p>
      </ResponsiveDialog>
    </PageMetaProvider>
  );
}

import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Dialog } from 'radix-ui';
import { ChevronDown, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { readPreference, writePreference } from '@/lib/theme';
import { Tooltip } from '@/components/ui/tooltip';
import { visibleGroups, WORKSPACE, type NavItem } from './navigation';

// §7.1 Sidebar: full (240 px) from lg, icon rail (64 px) on tablet or when collapsed, drawer below md.

const OPEN_GROUPS_KEY = 'rcl.nav.groups';

function readOpenGroups(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { brand } = useTheme();
  const [broken, setBroken] = useState(false);
  const src = collapsed ? brand.logoMark ?? brand.logo : brand.logo;
  return (
    <div className={cn('flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-foreground/15', collapsed ? 'justify-center px-2' : 'px-5')}>
      {src && !broken ? (
        <img src={src} alt={brand.name} onError={() => setBroken(true)} className={cn('object-contain', collapsed ? 'size-8' : 'h-8 max-w-[180px]')} />
      ) : collapsed ? (
        <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-active text-sm font-semibold text-primary-foreground">
          {brand.shortName}
        </span>
      ) : (
        <span className="truncate text-lg font-semibold text-sidebar-foreground">{brand.name}</span>
      )}
    </div>
  );
}

function NavEntry({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-md text-sm font-medium transition-colors duration-[120ms] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sidebar-foreground',
        collapsed ? 'size-10 justify-center' : 'h-9 px-3 pointer-coarse:h-12',
        isActive ? 'bg-sidebar-active text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground',
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
  return collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link;
}

function NavContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { hasRight } = useAuth();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(readOpenGroups);
  const groups = visibleGroups(hasRight);
  const admin = groups.filter((g) => g.collapsible);
  const other = groups.filter((g) => !g.collapsible);

  const toggle = (id: string, open: boolean) => {
    const next = { ...openGroups, [id]: open };
    setOpenGroups(next);
    writePreference(OPEN_GROUPS_KEY, JSON.stringify(next));
  };

  const heading = (label: string) =>
    collapsed ? <div className="mx-3 my-3 h-px bg-sidebar-foreground/15" /> : (
      <p className="px-3 pb-1 pt-5 text-micro uppercase tracking-wide text-sidebar-foreground/60">{label}</p>
    );

  return (
    <nav aria-label="Main" className={cn('flex-1 overflow-y-auto py-3', collapsed ? 'flex flex-col items-center gap-1 px-2' : 'space-y-0.5 px-3')}>
      {WORKSPACE.map((item) => <NavEntry key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />)}
      {other.map((group) => (
        <div key={group.id} className={cn(collapsed && 'flex flex-col items-center gap-1')}>
          {heading(group.label)}
          {group.items.map((item) => <NavEntry key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />)}
        </div>
      ))}
      {admin.length > 0 && heading('Administration')}
      {admin.map((group) => {
        const containsActive = group.items.some((i) => location.pathname.startsWith(i.to));
        const open = collapsed || (openGroups[group.id] ?? containsActive);
        return (
          <div key={group.id} className={cn(collapsed && 'flex flex-col items-center gap-1')}>
            {!collapsed && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(group.id, !open)}
                className="flex h-9 w-full items-center justify-between rounded-md px-3 text-sm text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground pointer-coarse:h-12"
              >
                {group.label}
                <ChevronDown aria-hidden className={cn('size-4 transition-transform', !open && '-rotate-90')} />
              </button>
            )}
            {open && (
              <div className={cn(!collapsed && 'ml-2 space-y-0.5 border-l border-sidebar-foreground/15 pl-2', collapsed && 'flex flex-col items-center gap-1')}>
                {group.items.map((item) => <NavEntry key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />)}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => readPreference('rcl.nav.collapsed', ['1', '0'] as const) === '1');
  const set = (value: boolean) => {
    setCollapsed(value);
    writePreference('rcl.nav.collapsed', value ? '1' : '0');
  };
  return [collapsed, set] as const;
}

export function Sidebar({ collapsed, onCollapsedChange }: { collapsed: boolean; onCollapsedChange: (v: boolean) => void }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-drawer hidden flex-col bg-sidebar transition-[width] duration-300 md:flex',
        collapsed ? 'w-16' : 'w-16 lg:w-60',
      )}
    >
      {/* Tablet always shows the rail; desktop follows the persisted preference. */}
      <div className={cn('flex min-h-0 flex-1 flex-col', !collapsed && 'lg:hidden')}>
        <Brand collapsed />
        <NavContent collapsed />
      </div>
      {!collapsed && (
        <div className="hidden min-h-0 flex-1 flex-col lg:flex">
          <Brand collapsed={false} />
          <NavContent collapsed={false} />
        </div>
      )}
      <div className="hidden border-t border-sidebar-foreground/15 p-2 lg:block">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn('flex h-9 items-center gap-2 rounded-md px-3 text-sm text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground', collapsed ? 'w-full justify-center px-0' : 'w-full')}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}

// Below md: an off-canvas drawer that traps focus and closes on navigate, Esc or overlay tap.
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-drawer-overlay bg-overlay animate-fade-in md:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-drawer flex w-72 max-w-[85vw] flex-col bg-sidebar outline-none md:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">Main menu</Dialog.Description>
          <div className="relative">
            <Brand collapsed={false} />
            <Dialog.Close className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-foreground/10" aria-label="Close menu">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <NavContent collapsed={false} onNavigate={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

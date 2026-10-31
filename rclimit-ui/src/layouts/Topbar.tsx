import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Menu, Monitor, Moon, Rows3, Rows4, Search, Sun, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/button';
import { DropdownMenu, MenuContent } from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/tooltip';
import type { ColorMode } from '@/lib/theme';
import { useBreadcrumbs } from './PageMeta';

// §7.1 Topbar: menu button, breadcrumbs, command palette trigger, color mode, user menu.

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={size === 'sm'
        ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-micro text-primary'
        : 'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary'}
    >
      {initials(name)}
    </span>
  );
}

const MODE_ICON: Record<ColorMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const MODE_ORDER: ColorMode[] = ['light', 'dark', 'system'];
const MODE_LABEL: Record<ColorMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };

function Breadcrumbs() {
  const { crumbs } = useBreadcrumbs();
  const parent = [...crumbs].reverse().find((c, i) => i > 0 && c.to);
  return (
    <>
      {/* Below lg a back link replaces the trail (§7.3). */}
      {parent && (
        <Link to={parent.to!} className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
          <ChevronLeft aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{parent.label}</span>
        </Link>
      )}
      <nav aria-label="Breadcrumb" className={parent ? 'hidden min-w-0 lg:block' : 'min-w-0'}>
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={`${c.label}-${i}`}>
                {i > 0 && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
                <li className={last ? 'min-w-0 truncate font-semibold text-foreground' : 'shrink-0 text-muted-foreground'} aria-current={last ? 'page' : undefined}>
                  {c.to && !last ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : c.label}
                </li>
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

export function Topbar({ onMenuClick, onOpenPalette }: { onMenuClick: () => void; onOpenPalette: () => void }) {
  const { user, logout } = useAuth();
  const { colorMode, setColorMode, density, setDensity } = useTheme();
  const navigate = useNavigate();
  const ModeIcon = MODE_ICON[colorMode];
  const nextMode = MODE_ORDER[(MODE_ORDER.indexOf(colorMode) + 1) % MODE_ORDER.length];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="sticky top-0 z-header flex h-14 items-center gap-2 border-b bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/80 md:px-6">
      <Button variant="ghost" size="icon" aria-label="Open menu" onClick={onMenuClick} className="-ml-2 md:hidden">
        <Menu />
      </Button>
      <div className="min-w-0 flex-1"><Breadcrumbs /></div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden h-8 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground hover:bg-muted sm:flex"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden lg:inline">Search or jump to…</span>
        <kbd className="rounded border bg-surface px-1.5 font-sans text-micro">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <Button variant="ghost" size="icon" aria-label="Search" onClick={onOpenPalette} className="sm:hidden"><Search /></Button>

      <Tooltip content={`Color mode: ${MODE_LABEL[colorMode]} (switch to ${MODE_LABEL[nextMode].toLowerCase()})`}>
        <Button variant="ghost" size="icon" aria-label={`Color mode: ${MODE_LABEL[colorMode]}`} onClick={() => setColorMode(nextMode)}>
          <ModeIcon />
        </Button>
      </Tooltip>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label="Account menu" className="flex items-center gap-2 rounded-full p-0.5 focus-visible:outline-2 focus-visible:outline-ring">
            <Avatar name={user?.fullName} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <MenuContent className="w-64">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium">{user?.fullName}</p>
              <p className="truncate text-caption text-muted-foreground">{user?.email}</p>
              {user?.roles && user.roles.length > 0 && (
                <p className="mt-1 truncate text-caption text-muted-foreground">{user.roles.map((r) => r.name).join(', ')}</p>
              )}
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item onSelect={() => navigate('/profile')} className={itemClass}>
              <UserRound className="size-4" /> Profile and preferences
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} className={itemClass}>
              {density === 'compact' ? <Rows3 className="size-4" /> : <Rows4 className="size-4" />}
              {density === 'compact' ? 'Comfortable density' : 'Compact density'}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item onSelect={() => void logout()} className={itemClass}>
              <LogOut className="size-4" /> Log out
            </DropdownMenu.Item>
          </MenuContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}

const itemClass = 'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted pointer-coarse:py-3';

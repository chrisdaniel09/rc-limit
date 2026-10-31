import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { visibleGroups } from './navigation';

// T5: section nav on the left (240 px), content up to 960 px. Masters and Access control use it (§10.11–10.12).
export function SettingsLayout({ section }: { section: 'masters' | 'access' }) {
  const { hasRight } = useAuth();
  const group = visibleGroups(hasRight).find((g) => g.id === section);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
      {group && group.items.length > 1 && (
        <nav aria-label={group.label} className="-mx-4 shrink-0 overflow-x-auto px-4 lg:mx-0 lg:w-56 lg:px-0">
          <p className="mb-2 hidden text-label text-muted-foreground lg:block">{group.label}</p>
          <ul className="flex gap-1 border-b lg:flex-col lg:border-b-0">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => cn(
                      'flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                      'border-b-2 lg:rounded-md lg:border-b-0',
                      isActive ? 'border-primary text-foreground lg:bg-primary-subtle lg:text-primary' : 'border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-muted',
                    )}
                  >
                    <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <div className="min-w-0 flex-1 lg:max-w-[960px]">
        <Outlet />
      </div>
    </div>
  );
}

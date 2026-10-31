import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/cn';

// §8.16: underline tabs with counts, kept in the URL (?tab=ledger), scrollable on mobile.

export interface TabDef {
  value: string;
  label: string;
  count?: number | null;
  content: ReactNode;
  hidden?: boolean;
}

interface TabsProps {
  tabs: TabDef[];
  // URL query key; pass null to keep the tab in local state only.
  param?: string | null;
  defaultValue?: string;
  className?: string;
  toolbar?: ReactNode;
}

export function Tabs({ tabs, param = 'tab', defaultValue, className, toolbar }: TabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const visible = tabs.filter((t) => !t.hidden);
  const fallback = defaultValue ?? visible[0]?.value;
  const fromUrl = param ? searchParams.get(param) : null;
  const value = visible.some((t) => t.value === fromUrl) ? fromUrl! : fallback;

  const onValueChange = (next: string) => {
    if (!param) return;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === fallback) p.delete(param);
      else p.set(param, next);
      return p;
    }, { replace: true });
  };

  return (
    <TabsPrimitive.Root value={param ? value : undefined} defaultValue={param ? undefined : fallback} onValueChange={onValueChange} className={className}>
      <div className="flex items-end justify-between gap-3 border-b">
        <TabsPrimitive.List className="-mb-px flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
          {visible.map((t) => (
            <TabsPrimitive.Trigger
              key={t.value}
              value={t.value}
              className="inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:text-foreground pointer-coarse:min-h-12"
            >
              {t.label}
              {t.count != null && (
                <span className="num rounded-full bg-muted px-1.5 text-micro text-muted-foreground">{t.count}</span>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
        {toolbar && <div className="mb-1.5 flex shrink-0 items-center gap-2">{toolbar}</div>}
      </div>
      {visible.map((t) => (
        <TabsPrimitive.Content key={t.value} value={t.value} className={cn('pt-4 outline-none')}>
          {t.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

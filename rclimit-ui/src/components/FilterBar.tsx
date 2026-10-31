import { useState, type ReactNode } from 'react';
import { Bookmark, BookmarkPlus, Check, ChevronDown, ListFilter, Search, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { SortDir } from '@/hooks/useListState';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/choice';
import { Combobox, type ComboOption } from '@/components/ui/combobox';
import { ResponsiveDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { DropdownMenu, MenuContent, Popover } from '@/components/ui/menu';
import { formatDate } from '@/lib/format';
import { DateInput } from '@/components/inputs';

// §8.8 FilterBar: search, filter chips, "+ Filter" menu, clear all, saved views. Values live in the URL via useListState.

export type FilterDef =
  | { key: string; label: string; type: 'multi'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'single'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'combobox'; search?: (term: string) => Promise<ComboOption[]>; options?: ComboOption[]; selectedLabel?: (value: string) => string | undefined }
  | { key: string; label: string; type: 'boolean'; trueLabel?: string }
  // Two URL keys: `${from}` and `${to}`.
  | { key: string; label: string; type: 'dateRange'; from: string; to: string };

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: FilterDef[];
  values?: Record<string, string>;
  onChange?: (changes: Record<string, string>) => void;
  onClearAll?: () => void;
  // Shown on the right (segmented scope, export…).
  actions?: ReactNode;
  savedViews?: ReactNode;
  resultCount?: number | null;
  resultLabel?: string;
}

const multiValues = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : []);

function DATE_PRESETS(): { label: string; from: string; to: string }[] {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 29);
  // Indian financial year starts 1 April.
  const fyStart = new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1);
  return [
    { label: 'Today', from: iso(today), to: iso(today) },
    { label: 'This week', from: iso(startOfWeek), to: iso(today) },
    { label: 'This month', from: iso(startOfMonth), to: iso(today) },
    { label: 'Last 30 days', from: iso(last30), to: iso(today) },
    { label: 'This FY', from: iso(fyStart), to: iso(today) },
  ];
}

function chipText(def: FilterDef, values: Record<string, string>): string | null {
  switch (def.type) {
    case 'multi': {
      const selected = multiValues(values[def.key]);
      if (!selected.length) return null;
      return selected.map((v) => def.options.find((o) => o.value === v)?.label ?? v).join(', ');
    }
    case 'single':
      return values[def.key] ? def.options.find((o) => o.value === values[def.key])?.label ?? values[def.key] : null;
    case 'combobox':
      return values[def.key] ? def.selectedLabel?.(values[def.key]) ?? def.options?.find((o) => o.value === values[def.key])?.label ?? 'Selected' : null;
    case 'boolean':
      return values[def.key] === 'true' ? def.trueLabel ?? 'Yes' : null;
    case 'dateRange': {
      const from = values[def.from];
      const to = values[def.to];
      if (!from && !to) return null;
      if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
      return from ? `From ${formatDate(from)}` : `Until ${formatDate(to)}`;
    }
  }
}

function clearChanges(def: FilterDef): Record<string, string> {
  return def.type === 'dateRange' ? { [def.from]: '', [def.to]: '' } : { [def.key]: '' };
}

function FilterEditor({ def, values, onChange }: { def: FilterDef; values: Record<string, string>; onChange: (changes: Record<string, string>) => void }) {
  switch (def.type) {
    case 'multi': {
      const selected = multiValues(values[def.key]);
      return (
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {def.options.map((o) => (
            <Checkbox
              key={o.value}
              label={o.label}
              checked={selected.includes(o.value)}
              onCheckedChange={(checked) => {
                const next = checked ? [...selected, o.value] : selected.filter((v) => v !== o.value);
                onChange({ [def.key]: next.join(',') });
              }}
              className="rounded-sm px-1 py-1 hover:bg-muted"
            />
          ))}
        </div>
      );
    }
    case 'single':
      return (
        <div className="space-y-0.5">
          {def.options.map((o) => {
            const active = values[def.key] === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ [def.key]: active ? '' : o.value })}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted pointer-coarse:py-3"
              >
                {o.label}
                {active && <Check aria-hidden className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
      );
    case 'combobox':
      return (
        <Combobox
          aria-label={def.label}
          value={values[def.key] ?? ''}
          onValueChange={(v) => onChange({ [def.key]: v })}
          options={def.options}
          search={def.search}
          selectedLabel={values[def.key] ? def.selectedLabel?.(values[def.key]) : undefined}
          placeholder={`Any ${def.label.toLowerCase()}`}
          clearable
        />
      );
    case 'boolean':
      return (
        <Switch
          label={def.trueLabel ?? def.label}
          checked={values[def.key] === 'true'}
          onCheckedChange={(checked) => onChange({ [def.key]: checked ? 'true' : '' })}
        />
      );
    case 'dateRange':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange({ [def.from]: p.from, [def.to]: p.to })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-caption hover:bg-muted pointer-coarse:py-2',
                  values[def.from] === p.from && values[def.to] === p.to && 'border-primary bg-primary-subtle text-primary',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><DateInput value={values[def.from] ?? ''} onValueChange={(v) => onChange({ [def.from]: v })} /></Field>
            <Field label="To"><DateInput value={values[def.to] ?? ''} onValueChange={(v) => onChange({ [def.to]: v })} /></Field>
          </div>
        </div>
      );
  }
}

export function FilterBar({
  searchValue, onSearchChange, searchPlaceholder, filters = [], values = {}, onChange, onClearAll, actions, savedViews, resultCount, resultLabel,
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = filters.map((def) => ({ def, text: chipText(def, values) })).filter((f) => f.text);
  const inactive = filters.filter((def) => !chipText(def, values));
  const change = (c: Record<string, string>) => onChange?.(c);

  const search = (
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        data-list-search
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="pl-8"
      />
      <kbd aria-hidden className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 text-micro text-muted-foreground lg:block">/</kbd>
    </div>
  );

  const chips = active.map(({ def, text }) => (
    <span key={def.key} className="inline-flex max-w-full shrink-0 items-center rounded-full border border-primary/30 bg-primary-subtle text-sm text-foreground">
      <Popover
        open={editing === def.key}
        onOpenChange={(o) => setEditing(o ? def.key : null)}
        trigger={
          <button type="button" className="max-w-64 truncate py-1 pl-3 pr-1 text-left pointer-coarse:py-2.5" disabled={isMobile} onClick={() => isMobile && setSheetOpen(true)}>
            <span className="text-muted-foreground">{def.label}:</span> {text}
          </button>
        }
      >
        <p className="mb-2 text-label text-muted-foreground">{def.label}</p>
        <FilterEditor def={def} values={values} onChange={change} />
      </Popover>
      <button
        type="button"
        aria-label={`Remove ${def.label} filter`}
        onClick={() => change(clearChanges(def))}
        className="mr-1 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </span>
  ));

  const addMenu = filters.length > 0 && (
    isMobile ? (
      <Button variant="outline" icon={ListFilter} onClick={() => setSheetOpen(true)} className="shrink-0">
        Filters{active.length > 0 && <span className="num rounded-full bg-primary px-1.5 text-micro text-primary-foreground">{active.length}</span>}
      </Button>
    ) : inactive.length > 0 && (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline" size="sm" icon={ListFilter} className="h-8 shrink-0 border-dashed">Filter <ChevronDown aria-hidden /></Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <MenuContent align="start">
            {inactive.map((def) => (
              <DropdownMenu.Sub key={def.key}>
                <DropdownMenu.SubTrigger className="flex cursor-default items-center justify-between gap-4 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[state=open]:bg-muted">
                  {def.label}
                  <ChevronDown aria-hidden className="size-3.5 -rotate-90 text-muted-foreground" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent sideOffset={6} className="z-tooltip w-72 rounded-md border bg-surface-raised p-3 text-foreground shadow-md" onKeyDown={(e) => e.stopPropagation()}>
                    <p className="mb-2 text-label text-muted-foreground">{def.label}</p>
                    <FilterEditor def={def} values={values} onChange={change} />
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            ))}
          </MenuContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  );

  const clearAll = (active.length > 0 || searchValue) && onClearAll && (
    <Button variant="ghost" size="sm" onClick={onClearAll} className="h-8 shrink-0 text-muted-foreground">Clear all</Button>
  );

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {isMobile && addMenu}
        {!isMobile && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {chips}
            {addMenu}
            {clearAll}
          </div>
        )}
        {(actions || savedViews) && <div className="flex shrink-0 items-center gap-2">{savedViews}{actions}</div>}
      </div>
      {isMobile && active.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{chips}{clearAll}</div>
      )}
      {resultCount != null && (
        <p className="sr-only" aria-live="polite">{resultCount} {resultLabel ?? 'results'}</p>
      )}
      {isMobile && (
        <ResponsiveDialog
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Filters"
          footer={
            <>
              {onClearAll && <Button variant="outline" onClick={() => { onClearAll(); setSheetOpen(false); }}>Clear all</Button>}
              <Button onClick={() => setSheetOpen(false)}>Show results</Button>
            </>
          }
        >
          <div className="space-y-5">
            {filters.map((def) => (
              <div key={def.key}>
                <p className="mb-2 text-label text-foreground">{def.label}</p>
                <FilterEditor def={def} values={values} onChange={change} />
              </div>
            ))}
          </div>
        </ResponsiveDialog>
      )}
    </div>
  );
}

// ---------- Saved views (§8.8, phase 7) ----------
// Stored per user on this device; tenant-shared defaults are passed in by the page.

export interface SavedView {
  id: string;
  name: string;
  q?: string;
  sort?: string;
  dir?: SortDir;
  filters?: Record<string, string>;
  builtIn?: boolean;
}

function readViews(key: string): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}

export function SavedViews({ storageKey, defaults = [], current, onApply }: {
  storageKey: string;
  defaults?: SavedView[];
  current: Omit<SavedView, 'id' | 'name'>;
  onApply: (view: SavedView) => void;
}) {
  const key = `rcl.views.${storageKey}`;
  const [views, setViews] = useState<SavedView[]>(() => readViews(key));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const persist = (next: SavedView[]) => {
    setViews(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Kept for this visit only.
    }
  };

  const all = [...defaults.map((d) => ({ ...d, builtIn: true })), ...views];

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="outline" size="sm" icon={Bookmark} className="h-8">Views <ChevronDown aria-hidden /></Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <MenuContent className="w-60">
            {all.length === 0 && <p className="px-2 py-1.5 text-caption text-muted-foreground">No saved views yet.</p>}
            {all.map((v) => (
              <div key={v.id} className="group flex items-center">
                <DropdownMenu.Item
                  onSelect={() => onApply(v)}
                  className="flex-1 cursor-default truncate rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
                >
                  {v.name}
                </DropdownMenu.Item>
                {!v.builtIn && (
                  <button
                    type="button"
                    aria-label={`Delete view ${v.name}`}
                    onClick={() => persist(views.filter((x) => x.id !== v.id))}
                    className="mr-1 flex size-7 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-danger focus:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item onSelect={() => setNaming(true)} className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted">
              <BookmarkPlus className="size-4" /> Save current view…
            </DropdownMenu.Item>
          </MenuContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ResponsiveDialog
        open={naming}
        onOpenChange={(o) => { setNaming(o); if (!o) setName(''); }}
        title="Save view"
        description="Saves the current search, filters and sort on this device."
        size="sm"
        onSubmit={() => {
          if (!name.trim()) return;
          persist([...views, { ...current, id: crypto.randomUUID(), name: name.trim() }]);
          setNaming(false);
          setName('');
        }}
        footer={
          <>
            <Button variant="outline" onClick={() => setNaming(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Save view</Button>
          </>
        }
      >
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My open leads" maxLength={60} />
        </Field>
      </ResponsiveDialog>
    </>
  );
}

// Bulk action bar shown when rows are selected (§8.6).
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-4 py-2">
      <span className="num text-sm font-medium text-foreground">{count} selected</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <Button variant="ghost" size="sm" onClick={onClear}>Clear selection</Button>
    </div>
  );
}

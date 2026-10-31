import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, Loader2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClass } from './input';

// §8.4 Combobox for record-backed pickers. Searches the server after 2 characters (250 ms debounce), or filters
// a static list when `options` is given.

export interface ComboOption {
  value: string;
  label: string;
  secondary?: ReactNode;
  disabled?: boolean;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string, option: ComboOption | null) => void;
  // Static options (filtered locally) …
  options?: ComboOption[];
  // … or a server search. Return the matching options.
  search?: (term: string) => Promise<ComboOption[]>;
  // Label for the current value when it isn't in the loaded options (server mode).
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: (term: string) => string;
  createAction?: { label: string; onSelect: (term: string) => void };
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

export function Combobox({
  value, onValueChange, options, search, selectedLabel, placeholder = 'Select…', searchPlaceholder = 'Search…',
  emptyText = (t) => (t ? `No results for "${t}"` : 'No options'), createAction, disabled, clearable, id, className, ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [remote, setRemote] = useState<ComboOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<ComboOption | null>(null);
  const latest = useRef(0);

  const isServer = !options && !!search;
  const list = isServer ? remote : options ?? [];

  useEffect(() => {
    if (!isServer || !open) return;
    const trimmed = term.trim();
    if (trimmed.length < MIN_CHARS) {
      setRemote([]);
      setLoading(false);
      return;
    }
    const requestId = ++latest.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await search!(trimmed);
        if (requestId === latest.current) setRemote(results);
      } catch {
        if (requestId === latest.current) setRemote([]);
      } finally {
        if (requestId === latest.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, open, isServer, search]);

  const current = value ? list.find((o) => o.value === value) ?? (picked?.value === value ? picked : undefined) : undefined;
  const display = current?.label ?? (value ? selectedLabel ?? value : '');

  const select = (option: ComboOption) => {
    setPicked(option);
    onValueChange(option.value, option);
    setOpen(false);
    setTerm('');
  };

  const hint = isServer && term.trim().length < MIN_CHARS ? `Type at least ${MIN_CHARS} characters to search` : null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTerm(''); }}>
      <div className="relative">
        <PopoverPrimitive.Trigger asChild disabled={disabled}>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            className={cn(controlClass, 'flex h-control items-center justify-between gap-2 text-left', !display && 'text-muted-foreground', clearable && value && 'pr-14', className)}
            {...aria}
          >
            <span className="truncate">{display || placeholder}</span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverPrimitive.Trigger>
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => onValueChange('', null)}
            className="absolute right-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-tooltip w-[max(var(--radix-popover-trigger-width),280px)] rounded-md border bg-surface-raised p-0 text-foreground shadow-md outline-none animate-fade-in"
        >
          <Command shouldFilter={!isServer} loop>
            <Command.Input
              value={term}
              onValueChange={setTerm}
              placeholder={searchPlaceholder}
              className="h-10 w-full border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="max-h-72 overflow-y-auto p-1">
              {loading && (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </div>
              )}
              {!loading && hint && <div className="px-2 py-3 text-sm text-muted-foreground">{hint}</div>}
              {!loading && !hint && (
                <Command.Empty className="px-2 py-3 text-sm text-muted-foreground">{emptyText(term.trim())}</Command.Empty>
              )}
              {list.map((o) => (
                <Command.Item
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  disabled={o.disabled}
                  onSelect={() => select(o)}
                  className="flex cursor-default items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-muted pointer-coarse:py-3"
                >
                  <Check aria-hidden className={cn('mt-0.5 size-4 shrink-0', o.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.secondary && <span className="block truncate text-caption text-muted-foreground">{o.secondary}</span>}
                  </span>
                </Command.Item>
              ))}
              {createAction && (
                <Command.Item
                  value={`__create__ ${term}`}
                  onSelect={() => { setOpen(false); createAction.onSelect(term.trim()); }}
                  className="mt-1 flex cursor-default items-center gap-2 rounded-sm border-t px-2 py-1.5 text-sm text-primary outline-none data-[selected=true]:bg-muted"
                >
                  <Plus className="size-4" /> {createAction.label}
                </Command.Item>
              )}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

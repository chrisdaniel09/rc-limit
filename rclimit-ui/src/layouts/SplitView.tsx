import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { readPreference, writePreference } from '@/lib/theme';
import { useIsWide } from '@/hooks/useMediaQuery';

// §7.3 T2 master-detail split pane (≥ 1280 px). List 35% (min 360, max 520), resizable and persisted; detail scrolls on
// its own. Esc in the detail returns focus to the list.

const MIN = 360;
const MAX = 520;

interface SplitViewProps {
  storageKey: string;
  list: ReactNode;
  detail: ReactNode | null;
  fullPageHref?: string | null;
  onClose: () => void;
}

export function SplitView({ storageKey, list, detail, fullPageHref, onClose }: SplitViewProps) {
  const key = `rcl.split.${storageKey}`;
  const [width, setWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      return stored >= MIN && stored <= MAX ? stored : 440;
    } catch {
      return 440;
    }
  });
  const dragging = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  const save = useCallback((w: number) => writePreference(key, String(Math.round(w))), [key]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !listRef.current) return;
      const left = listRef.current.getBoundingClientRect().left;
      setWidth(Math.min(MAX, Math.max(MIN, e.clientX - left)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = '';
      setWidth((w) => {
        save(w);
        return w;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [save]);

  const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = Math.min(MAX, Math.max(MIN, width + (e.key === 'ArrowRight' ? 20 : -20)));
    setWidth(next);
    save(next);
  };

  const onDetailKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      listRef.current?.querySelector<HTMLElement>('[aria-selected="true"] [data-primary-link], [data-primary-link]')?.focus();
    }
  };

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100dvh-3.5rem)]">
      <div ref={listRef} style={{ width }} className="flex shrink-0 flex-col overflow-y-auto border-r px-4 py-4">
        {list}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onKeyDown={onHandleKey}
        onPointerDown={() => {
          dragging.current = true;
          document.body.style.userSelect = 'none';
        }}
        className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 focus-visible:bg-primary/50 focus-visible:outline-none"
      />
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4" onKeyDown={onDetailKey}>
        {detail ? (
          <>
            <div className="mb-2 flex justify-end gap-1">
              {fullPageHref && (
                <Tooltip content="Open full page">
                  <Button variant="ghost" size="icon-sm" asChild aria-label="Open full page">
                    <Link to={fullPageHref}><Maximize2 /></Link>
                  </Button>
                </Tooltip>
              )}
              <Tooltip content="Close">
                <Button variant="ghost" size="icon-sm" aria-label="Close detail" onClick={onClose}><X /></Button>
              </Tooltip>
            </div>
            {detail}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Select a record to see it here.</div>
        )}
      </div>
    </div>
  );
}

// Whether split view is on for this list: Leads default on, Loans opt-in per user (§15-8). Only at ≥ 1280 px.
export function useSplitPreference(storageKey: string, defaultOn: boolean) {
  const isWide = useIsWide();
  const key = `rcl.split.on.${storageKey}`;
  const [on, setOn] = useState(() => {
    const stored = readPreference(key, ['1', '0'] as const);
    return stored === null ? defaultOn : stored === '1';
  });
  const set = (value: boolean) => {
    setOn(value);
    writePreference(key, value ? '1' : '0');
  };
  return { available: isWide, enabled: isWide && on, preference: on, setPreference: set };
}

import { useEffect, useRef } from 'react';

// Global keyboard shortcuts (§11.6). Ignored while typing in inputs, except combos that say otherwise.

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

interface ShortcutMap {
  // Single key ("/", "n", "?") or a "g x" sequence.
  [keys: string]: (e: KeyboardEvent) => void;
}

export function useShortcuts(map: ShortcutMap, enabled = true) {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!enabled) return;
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      // Ignore keys while a dialog is open.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      const key = e.key;
      if (pendingG) {
        pendingG = false;
        clearTimeout(gTimer);
        const handler = mapRef.current[`g ${key.toLowerCase()}`];
        if (handler) {
          e.preventDefault();
          handler(e);
        }
        return;
      }
      if (key === 'g' && Object.keys(mapRef.current).some((k) => k.startsWith('g '))) {
        pendingG = true;
        gTimer = setTimeout(() => (pendingG = false), 1000);
        return;
      }
      const handler = mapRef.current[key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(gTimer);
    };
  }, [enabled]);
}

// Ctrl/⌘ K, which works even while typing.
export function useCommandK(onTrigger: () => void) {
  const ref = useRef(onTrigger);
  ref.current = onTrigger;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

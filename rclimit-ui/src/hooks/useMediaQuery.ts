import { useSyncExternalStore } from 'react';

function subscribe(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribe(query), () => window.matchMedia(query).matches, () => false);
}

// Breakpoints from §4.9.
export const useIsMobile = () => !useMediaQuery('(min-width: 768px)');
export const useIsWide = () => useMediaQuery('(min-width: 1280px)');

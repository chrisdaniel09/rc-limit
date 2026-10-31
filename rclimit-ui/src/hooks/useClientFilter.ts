import { useMemo, useState } from 'react';

// Search over a small list that the API returns whole (masters, roles, rights).
export function useClientFilter<T>(rows: T[] | null | undefined, text: (row: T) => (string | null | undefined)[]) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!rows) return rows;
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => text(row).some((t) => t?.toLowerCase().includes(term)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search]);
  return { search, setSearch, filtered, isFiltered: search.trim() !== '', clear: () => setSearch('') };
}

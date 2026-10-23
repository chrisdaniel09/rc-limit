type QueryValue = string | number | boolean | null | undefined;

// Builds a query string from the defined, non-empty values. Empty strings, null and undefined are skipped.
export function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
}

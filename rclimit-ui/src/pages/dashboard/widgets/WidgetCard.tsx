import type { ReactNode } from 'react';

interface WidgetCardProps {
  title: string;
  loading: boolean;
  hasData: boolean;
  error: string | null;
  onRefresh: () => void;
  children: ReactNode;
}

export default function WidgetCard({ title, loading, hasData, error, onRefresh, children }: WidgetCardProps) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label={`Refresh ${title}`}
          title="Refresh"
          className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <span className={loading ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
        </button>
      </header>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={onRefresh} className="font-medium underline">Retry</button>
        </div>
      ) : loading && !hasData ? (
        <div className="h-24 rounded bg-gray-100 animate-pulse" />
      ) : (
        children
      )}
    </section>
  );
}

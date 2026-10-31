import { authedFetch } from '@/api/client';
import { notifyError } from '@/components/ui/toast';

// Downloads a server-generated file (CSV export) with the session's token attached.
export async function downloadCsv(path: string, fallbackName: string): Promise<void> {
  try {
    const res = await authedFetch(path, { headers: { Accept: 'text/csv' } });
    if (!res.ok) throw new Error(res.status === 404 ? "Export isn't available yet." : `Export failed (HTTP ${res.status}).`);
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decodeURIComponent(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    notifyError(err, "The export didn't download");
  }
}

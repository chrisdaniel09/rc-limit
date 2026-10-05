import { getApiBaseUrl } from '../config';

interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errorCode?: string;
  correlationId?: string;
  traceId?: string;
}

function resolveUrl(url: string): string {
  return getApiBaseUrl() + url;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('rclimit_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(resolveUrl(url), { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('rclimit_token');
    localStorage.removeItem('rclimit_refresh');
    localStorage.removeItem('rclimit_user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
      try {
        const problem: ProblemDetails = await res.json();
        const message = problem.detail ?? problem.title ?? `HTTP ${res.status}`;
        const err = new Error(message);
        (err as ProblemDetailsError).problemDetails = problem;
        throw err;
      } catch (e) {
        if (e instanceof Error && (e as ProblemDetailsError).problemDetails) throw e;
      }
    }
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ProblemDetailsError extends Error {
  problemDetails: ProblemDetails;
}

export function apiGet<T>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

export function apiPost<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(url: string): Promise<void> {
  return apiFetch<void>(url, { method: 'DELETE' });
}

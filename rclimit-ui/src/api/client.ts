import { getApiBaseUrl } from '../config';
import type { User } from '../contexts/authContextValue';

// Session model (docs/user_session_architecture_specification.md, section 7).
// The access token lives in module memory only. The refresh token is an HttpOnly cookie that
// this code never reads. All requests send credentials, so the same build works in Profile A and B.

interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errorCode?: string;
  correlationId?: string;
  traceId?: string;
}

export interface ProblemDetailsError extends Error {
  problemDetails: ProblemDetails;
}

interface SessionEnvelope {
  data: {
    accessToken: string;
    expiresAt: string;
    user: User;
  };
}

type SessionListener = (user: User | null) => void;

const REFRESH_LOCK = 'rclimit-refresh';
const CSRF_HEADER = { 'X-CSRF': '1' };

let accessToken: string | null = null;
let currentUser: User | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<SessionListener>();

const url = (path: string) => `${getApiBaseUrl()}${path}`;

function publish(user: User | null): void {
  currentUser = user;
  listeners.forEach((listener) => listener(user));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getCurrentUser(): User | null {
  return currentUser;
}

/** Subscribes to session changes. Returns the unsubscribe function. */
export function subscribeSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setSession(token: string, user: User): void {
  accessToken = token;
  publish(user);
}

export function clearSession(): void {
  accessToken = null;
  publish(null);
}

async function toError(res: Response): Promise<Error> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      const problem = (await res.json()) as ProblemDetails;
      return Object.assign(new Error(problem.detail ?? problem.title ?? `HTTP ${res.status}`), {
        problemDetails: problem,
      }) as ProblemDetailsError;
    } catch {
      // Body was not valid JSON; fall through to the text message.
    }
  }
  const text = await res.text();
  return new Error(text || `HTTP ${res.status}`);
}

function postRefresh(): Promise<Response> {
  return fetch(url('/api/v1/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: CSRF_HEADER,
  });
}

async function runRefresh(): Promise<boolean> {
  let res = await postRefresh();
  if (res.status === 409) {
    // Another request rotated the token first; the cookie now holds the new one. Retry once.
    res = await postRefresh();
  }
  if (!res.ok) {
    clearSession();
    return false;
  }
  const body = (await res.json()) as SessionEnvelope;
  setSession(body.data.accessToken, body.data.user);
  return true;
}

/**
 * Single-flight refresh. Concurrent callers share one request, and a Web Lock serialises refreshes
 * across tabs so each refresh sees the cookie written by the previous one.
 */
export function refreshOnce(): Promise<boolean> {
  refreshing ??= (navigator.locks
    ? navigator.locks.request(REFRESH_LOCK, runRefresh)
    : runRefresh()
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Fetch with the access token attached. On 401, refreshes once and retries. Returns the raw Response. */
export async function authedFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(url(path), { ...init, headers, credentials: 'include' });
  if (res.status === 401 && !retried && (await refreshOnce())) {
    return authedFetch(path, init, true);
  }
  return res;
}

/** JSON API call. Throws ProblemDetailsError (or Error) on failure. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(path, init);
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(path: string): Promise<void> {
  return apiFetch<void>(path, { method: 'DELETE' });
}

/** Signs in. Throws with the server's message on failure. */
export async function loginRequest(email: string, password: string): Promise<void> {
  const res = await fetch(url('/api/v1/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await toError(res);
  const body = (await res.json()) as SessionEnvelope;
  setSession(body.data.accessToken, body.data.user);
}

/** Revokes the session on the server and clears local state, even if the request fails. */
export async function logoutRequest(): Promise<void> {
  try {
    await fetch(url('/api/v1/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: CSRF_HEADER,
    });
  } finally {
    clearSession();
  }
}

# User Session & Authentication Architecture Specification

**Status:** Implemented in code for both deployment profiles. Section 11 lists what is implemented, and what remains open (edge infrastructure, breached-password screening, the audit store, and secret rotation).

The current deployment runs the **interim cross-site profile (Profile B)**, which is temporary. Section 3.5 is the runbook for switching to the target same-site profile (Profile A). Both profiles run the same code, and the switch is configuration only (section 3.6).

This specification defines session management, token handling, tenant-specific session policy and the multi-tenant authorization model for the **RCLimit** platform.

---

## 1. Goals and Scope

RCLimit is a multi-tenant SPA (`rclimit-ui`) backed by an ASP.NET Core API (`rclimit-backend-api`). The goals are:

* **No token in script-readable storage.** The refresh token is an `HttpOnly` cookie. The access token lives only in module memory.
* **Short-lived access, longer sessions without re-login.** Access tokens last minutes. Refresh rotates silently, within both an idle and an absolute session limit.
* **Stolen refresh tokens are detectable.** Rotation with reuse detection, scoped to the session family.
* **Strict tenant isolation.** Every request is bound to exactly one tenant, and cross-tenant use is rejected.
* **Tenant-controlled session lifetimes** within platform-defined bounds.

Out of scope: the authorization model for rights (see `docs/User_Roles_And_Rights.md`), and MFA (roadmap in section 8.4).

---

## 2. Standards and References

| Reference | Use in this spec |
| :--- | :--- |
| **RFC 9700**, *Best Current Practice for OAuth 2.0 Security* (BCP 240, 2025) | Primary baseline. Refresh token rotation for browser clients, redirect and CSRF guidance. It updates and extends RFC 6819. |
| **RFC 6819**, *OAuth 2.0 Threat Model and Security Considerations* (2013) | Historical threat model. Still useful as a threat catalogue, but RFC 9700 takes precedence where they differ. |
| **RFC 8725**, *JSON Web Token Best Current Practices* (BCP 225, 2020) | JWT algorithm pinning, key management, claim validation. |
| **RFC 9068**, *JWT Profile for OAuth 2.0 Access Tokens* (2021) | `typ: at+jwt` header and required access-token claims. |
| **RFC 9449**, *OAuth 2.0 Demonstrating Proof of Possession (DPoP)* (2023) | Future hardening: sender-constrained tokens (section 12). |
| **OWASP Session Management Cheat Sheet**, **OWASP ASVS** | Idle and absolute timeouts, session ID and cookie attributes, re-authentication. |
| **NIST SP 800-63B** | Password length, breached-password screening, no composition rules, rate limiting. |
| **IETF draft, *OAuth 2.0 for Browser-Based Applications*** (work in progress) | Ranking of browser token-storage options (section 3.4). Check the current draft revision before citing a version. |

---

## 3. Deployment Topology

### 3.1 Profile A (target, normative): same-origin edge

Every tenant host (default host, subdomain such as `acme.rclimit.in`, or a tenant's own custom domain) is served by a single **edge** (reverse proxy or CDN with routing, e.g. Azure Front Door, or the Static Web Apps linked backend in section 3.2). The edge routes:

* `/` and static assets to the static UI.
* `/api/*` to the API.

The browser therefore talks only to its own host. The cookie is **first-party** and `SameSite=Strict` works as designed.

**Edge requirements**

* **Refresh cookie:** name `__Secure-rclimit_rt`, attributes `Secure; HttpOnly; SameSite=Strict; Path=/api/v1/auth`, and **host-only** (no `Domain` attribute), so one tenant's cookie is never sent to another tenant's host. `Domain=.rclimit.in` is forbidden. The `__Host-` prefix cannot be used because it requires `Path=/`.
* **No CORS in Profile A.** The browser never makes cross-origin calls to the API. The API sends no CORS allowance in this profile.
* **Forwarded host:** the edge sets `X-Forwarded-Host` to the host the browser requested. It strips any client-supplied copy. The API accepts `X-Forwarded-Host` only from the edge.
* **Edge identity:** the edge adds a shared-secret header (`Auth:Edge:SharedSecretHeader`, default `X-Edge-Secret`) to every request it forwards. The API compares it in constant time and rejects any `/api` request without it. This is what makes the proxy impossible to bypass.
* **Client address:** behind the edge, the first `X-Forwarded-For` entry is the client address. It is used for rate limiting and audit only when the edge identity header is valid.
* **Custom domains:** each tenant domain needs a managed TLS certificate and a verified CNAME at the edge. Check the edge product's current custom-domain limits before onboarding tenants.
* **Transport and headers:** HSTS, TLS 1.2 or higher, request size limits, WAF rules, and security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).

### 3.2 Profile A implementation options

Both options meet the edge requirements in section 3.1.

* **A1: Azure Static Web Apps linked backend (preferred cutover path).** The UI's Static Web App serves `/` and forwards `/api/*` to the existing App Service, so both are on one host. Microsoft's documentation states that the integration requires the **Standard** Static Web Apps plan, that the App Service endpoint must use the `/api` prefix (already true for `/api/v1/*`), that one App Service links to one Static Web App, and that linked backends are not supported on pull-request environments ([Microsoft Learn: API support with Azure App Service](https://learn.microsoft.com/en-au/azure/static-web-apps/apis-app-service)). Before cutover, verify in staging which headers the linked backend forwards, in particular the host and `X-Forwarded-Host`, and whether it can add the edge identity header (section 3.1). Without the edge identity header, Profile A rejects every API request, so this check comes first. Custom tenant domains are served by the Static Web App's own custom-domain feature.
* **A2: Azure Front Door (or equivalent) in front of the UI and the API.** Needed if WAF rules, multi-region routing, or custom routing beyond A1 are required. Higher cost and configuration.

The choice between A1 and A2 is open (section 13).

### 3.3 Profile B: interim cross-site (temporary)

Profile B is used only until the cutover in section 3.5. Current hosts:

* UI: `https://ashy-hill-006ad3900.4.azurestaticapps.net`
* API: `https://rclimit-c8ancwfverfdc6ha.indiasouthcentral-01.azurewebsites.net`

Profile B differs from Profile A in these ways:

* **Refresh cookie:** `__Secure-rclimit_rt; Secure; HttpOnly; SameSite=None; Partitioned; Path=/api/v1/auth`. Cross-site requests need `SameSite=None`, which removes the browser's built-in CSRF protection, so the checks in section 6.6 are mandatory. `Partitioned` keys the cookie to the top-level site, so it is not shared between sites.
* **Tenant host source:** the `Origin` header, matched exactly against active tenant domains (`TenantAwareCorsPolicy` performs the same match for CORS). Login and refresh fail closed for unknown tenants. Non-browser clients can forge `Origin`. That only selects which tenant the request addresses. The user must still authenticate in that tenant, and the JWT `tenant_id` check (section 6.7) applies to every API call.
* **CORS:** an exact-origin allowlist with credentials, built from `Cors:AllowedOrigins` plus the origin of any active tenant. Never `*`. Responses set `Vary: Origin`.
* **Browser limits:** Safari blocks third-party cookies and Firefox partitions them by default. In those browsers silent refresh fails, so the access token is lost on page reload and the user signs in again. Chrome's third-party cookie policy has changed several times, so each release must re-test it. These limits are accepted for the interim only.
* **Same code:** Profile B uses the same code paths as Profile A. The only differences are the attribute and source switches listed above, selected by the profile setting (section 3.6).

### 3.4 Browser token-storage options (for reference)

| Option | Status |
| :--- | :--- |
| Token-mediating backend or BFF holding the refresh token | Equivalent to Profile A. Chosen in practice when the edge is the BFF. |
| Refresh token in same-site `HttpOnly` cookie, access token in memory | **Profile A. Normative.** |
| Browser-held tokens in `localStorage` or `sessionStorage` | **Prohibited.** Any XSS reads them. This was the pre-build state and has been removed. |

### 3.5 Switching from Profile B to Profile A (runbook)

Both profiles run the same code, so the switch is a sequence of configuration changes. The order keeps the system working at every step.

1. **Release code that supports both profiles.** Done. The API defaults to `Auth:DeploymentProfile = CrossSite`. The UI reads its API base URL at runtime from `public/config.json`.
2. **Test in staging** with the browser matrix (Chrome, Edge, Safari, Firefox) for: login; reload, which exercises silent refresh; refresh after the access token expires; logout; tenant mismatch (a token for tenant A sent to tenant B's host returns `403`); and a tenant's cookie not being sent to another tenant's host.
3. **Link the backend** (A1, section 3.2) on the production Static Web App while still on Profile B. Confirm that `https://<swa-host>/api/v1/...` responds and that the edge identity header arrives at the API.
4. **Move the UI onto the same origin.** Set the GitHub secret `API_BASE_URL` to an empty value and redeploy the UI. The API base URL is written into `config.json` at build time, so a redeploy is required. Requests now go to `/api/...` on the Static Web App host. Profile B cookies keep working, and Safari now works because the cookie is first-party. The CSRF origin check still passes, because the Static Web App's origin is in `Cors:AllowedOrigins`.
5. **Switch the API profile** to `SameSite`. Refresh cookies become `SameSite=Strict` without `Partitioned`, tenant resolution uses the forwarded host, edge enforcement is on, and `Cors:AllowedOrigins` must be cleared (startup validation enforces both).
6. **Restrict direct access** to the App Service so that only the edge can reach it (part of edge enforcement, section 3.1).

Users sign in once after step 4 and again after step 5, because the cookie's host or attributes change. Refresh rows in the database stay valid across both steps.

**Rollback:** reverse step 5 (profile back to `CrossSite`, restore the CORS origins), then step 4 (secret back to the App Service URL, UI redeployed). Both are configuration changes plus a UI redeploy.

### 3.6 Configuration reference

| Setting | Where | Value | Notes |
| :--- | :--- | :--- | :--- |
| `Auth:DeploymentProfile` | API app settings | `CrossSite` (Profile B) or `SameSite` (Profile A) | The single switch. It derives the cookie attributes, the tenant host source, the CSRF rules, and edge enforcement. These are not configurable separately. |
| `Cors:AllowedOrigins` | API app settings | `CrossSite`: the UI origin, e.g. `https://ashy-hill-006ad3900.4.azurestaticapps.net`. `SameSite`: empty. | Checked at startup. |
| `Auth:Edge:SharedSecretHeader` | API app settings | Default `X-Edge-Secret` | Header name the edge adds. |
| `Auth:Edge:SharedSecret` | Secret store | Random value of 32 bytes or more | Required when edge enforcement is on. |
| `Auth:Edge:DisableInDevelopment` | API app settings | `true` only in Development | Lets the Vite dev proxy call the API without the edge. Startup rejects it elsewhere. |
| `Auth:CookieName` | API app settings | `__Secure-rclimit_rt` | Same name in both profiles. |
| `Jwt:Secret` | Secret store (environment variable `Jwt__Secret`) | At least 256 bits | Not in `appsettings.json` (section 11). |
| `Jwt:AccessTokenExpirationMinutes`, `Jwt:RefreshTokenExpirationDays` | API app settings | Platform defaults (15 and 7) | Read as the defaults for tenant session policy (section 5.2). |
| `API_BASE_URL` | GitHub secret, written to `public/config.json` as `apiBaseUrl` | Profile B: the App Service URL. Profile A: empty (same origin). | Build-time value. Changing it requires a UI redeploy. |

**Startup validation.** The API refuses to start when the settings disagree with the profile:

* `CrossSite` with an empty `Cors:AllowedOrigins`, or with edge enforcement on.
* `SameSite` with a non-empty `Cors:AllowedOrigins`, or with edge enforcement off outside Development, or with edge enforcement on and no shared secret.
* `Auth:Edge:DisableInDevelopment` set outside Development.
* A `Jwt:Secret` shorter than 32 characters.

**Local development.** The Vite dev server proxies `/api` to the local API in Profile A (`SameSite`, with edge enforcement disabled). Open the app at `http://anna-finance.localhost:5173`. The proxy sets `X-Forwarded-Host` to `anna-finance.localhost:5173`, so the forwarded tenant host, the browser's `Origin`, and the seeded tenant slug all agree.

---

## 4. Token Specification

| Property | Access Token | Refresh Token |
| :--- | :--- | :--- |
| **Format** | Signed JWT, `alg: HS256`, `typ: at+jwt` (RFC 9068) | Opaque: 32 bytes from a CSPRNG, base64url encoded |
| **Signing key** | Secret of at least 256 bits, held in a secret store (not in `appsettings.json`). Asymmetric keys with `kid` rotation are the preferred future state. | Not applicable |
| **Storage (server)** | Not stored. Stateless validation. | SHA-256 hash only, in `auth.refresh_tokens` |
| **Storage (client)** | Module memory only (`api/client.ts`) | `HttpOnly` cookie set by the API |
| **Lifetime** | Default **15 minutes**. Tenant-configurable within bounds (section 5). | Idle window default **7 days**, with an absolute cap default **30 days** from session start. Both tenant-configurable within bounds. |
| **Transport** | `Authorization: Bearer <token>` | `Cookie: __Secure-rclimit_rt=<value>`, sent only to `/api/v1/auth/*` |
| **Claims** | `iss`, `aud`, `sub` (user id), `jti`, `iat`, `nbf`, `exp`, `sid` (session family id), `tenant_id`, `email`, `name`, `role` (repeated), `right` (repeated) | N/A |
| **Validation** | Verify signature, `iss`, `aud`, `exp`; `ClockSkew = 0`; pin `ValidAlgorithms = [HS256]` and `ValidTypes = [at+jwt]` | Lookup by hash; check tenant, user active, and the revocation and expiry state (section 6.3) |

Claim names: `role` and `right` are written as short names. The JWT bearer middleware maps `role` to the role claim type that the authorization handler reads. The `sid` claim binds the access token to its session family.

Tokens issued before this change have no `typ` header and fail validation. Users sign in once after deployment.

---

## 5. Tenant-Specific Session Policy

Each tenant can tune its session lifetimes within platform bounds. A tenant that does not set a value uses the platform default.

### 5.1 Settings

| Field | Meaning | Platform default | Allowed range |
| :--- | :--- | :--- | :--- |
| `access_token_minutes` | Access token lifetime | 15 | 5 to 60 |
| `idle_timeout_days` | Refresh token sliding window, reset on each successful refresh | 7 | 1 to 30 |
| `absolute_timeout_days` | Maximum session length from the initial login, regardless of activity | 30 | 1 to 90, and at least `idle_timeout_days` |
| `max_sessions_per_user` | Optional cap on concurrent sessions per user. The oldest session families are revoked when the cap is exceeded. | unlimited | 1 to 50 or unlimited |

### 5.2 Storage and resolution

* Settings are stored in **`system.tenant_settings`**. Migration `rclimit-db/migrations/025_tenant_session_policy.sql` adds nullable columns, range `CHECK` constraints, and one settings row per tenant.
* Platform defaults come from the `Jwt` configuration section (`AccessTokenExpirationMinutes`, `RefreshTokenExpirationDays`). Bounds are in code, in `TenantSessionPolicyProvider`.
* `ITenantSessionPolicyProvider` reads the settings with a 5-minute in-memory cache. `Invalidate(tenantId)` evicts an entry. Values are clamped to the allowed ranges in code too, so an out-of-range database value cannot weaken security.

### 5.3 Application rules

* Login and refresh read the tenant policy and set:
  * access token `exp = now + access_token_minutes`;
  * refresh token `expires_at = min(now + idle_timeout_days, session_started_at + absolute_timeout_days)`;
  * cookie `Expires` equal to the refresh token's `expires_at`.
* JWT validation needs no change because it reads `exp`.
* **Timing:** changes apply to tokens issued after the change. A shorter idle window takes effect at each user's next refresh. For immediate effect, revoke the tenant's sessions (section 6.5).

### 5.4 Editing

Changing session settings needs a settings API guarded by a new right, `tenant.settings.manage`. Each change writes an audit record (section 9). **Not yet implemented:** the settings API and its UI screen. The database columns and the policy provider are in place.

---

## 6. Backend Endpoints and Handler Behaviour (.NET 10)

```
[ Browser ] ── same origin (Profile A) / cross-site (Profile B) ──► [ API ]
     │
     ├─ POST /api/v1/auth/login  (X-CSRF) ───────► LoginCommandHandler
     │     ◄─ 200 JSON { accessToken, expiresAt, user }   (no refresh token in body)
     │     ◄─ Set-Cookie __Secure-rclimit_rt (HttpOnly, Path=/api/v1/auth)
     │
     ├─ GET /api/v1/... (Bearer) ─────────────────► TenantMiddleware ► Controller
     │
     ├─ POST /api/v1/auth/refresh (cookie, X-CSRF) ─► RefreshTokenCommandHandler
     │     ◄─ 200 JSON { accessToken, expiresAt, user }
     │     ◄─ Set-Cookie (rotated refresh token)
     │
     └─ POST /api/v1/auth/logout (cookie, X-CSRF) ─► LogoutCommandHandler
           ◄─ 204, cookie cleared
```

### 6.1 Response envelope, caching and removed endpoints

All auth responses use the existing HATEOAS envelope (`HateoasResponse<T>`, with the payload under `data`). Login, refresh and logout set `Cache-Control: no-store`.

The refresh token is **never** in a response body. `AuthBody` (the JSON shape) has no refresh token. `AuthResponse` carries it inside the application layer only, and the controller moves it into the cookie.

**`POST /api/v1/auth/register` has been removed.** It issued a session cookie to the new user inside the admin's browser. Accounts are now created by admins through `POST /api/v1/users` (`users.manage`), which issues no session.

### 6.2 Login (`POST /api/v1/auth/login`)

1. **CSRF guard** (section 6.6). Login is guarded too, so a cross-site form cannot force a login into the victim's browser.
2. **Rate limit:** 20 requests per client IP per 15 minutes (policy `auth-login`). Exceeding it returns `429`.
3. Resolve the tenant (section 6.7). Unknown or inactive tenants fail closed.
4. Find the user by email within the tenant.
5. **Verify.** The password is always verified, even for unknown emails, against a cached dummy hash so that timing does not reveal account existence. Every failure returns the same `401` message, `Invalid email or password.`, whether the email is unknown, the password is wrong, the account is locked, or the account is inactive.
6. **Lockout:** 5 consecutive failed passwords lock the account for 15 minutes. A successful login clears the count.
7. Create a session family: a new `family_id` and `session_started_at = now`. The session cap (section 5.1) is applied here.
8. Generate the refresh token (32 CSPRNG bytes, base64url). Store its SHA-256 hash with the family, tenant, user, session start, `expires_at`, client IP and user agent.
9. Issue the access token (section 4) with `sid = family_id`.
10. Write the cookie as a raw `Set-Cookie` header, so the `Partitioned` attribute is always present:

```
Set-Cookie: __Secure-rclimit_rt=<value>; Expires=<refresh expiry, RFC 1123>; Path=/api/v1/auth; Secure; HttpOnly; SameSite=None; Partitioned
```

In Profile A, the attributes are `SameSite=Strict` and no `Partitioned`.

### 6.3 Refresh and rotation (`POST /api/v1/auth/refresh`)

1. CSRF guard (section 6.6). Otherwise `403`.
2. Rate limit: 120 requests per client IP per 15 minutes (policy `auth-refresh`).
3. Read the cookie. If absent, `401`.
4. Look up the row by hash. If it does not exist, `401`. If the row belongs to another tenant, `401`.
5. Classify the presented token:
   * **Active** (not revoked, not expired, user active): continue to step 6.
   * **Rotated within the grace window** (`revoked_reason = ROTATED`, revoked less than `Auth:Session:ReuseGraceSeconds` ago, default 30): a benign concurrent refresh. Return `409 Conflict` and revoke nothing. The client retries once with the cookie the winning request set.
   * **Rotated after the grace window**, or revoked for any other reason: **reuse**. Revoke every token in the family, write a security log event (`auth.refresh.reuse_detected`), return `401`.
   * **Expired** (`expires_at` passed), or **user inactive**: revoke the family and return `401`.
6. **Rotate** in one `SaveChanges` call: the presented row becomes `ROTATED` with `replaced_by_token_id` set, and the new row joins the same family. The new `expires_at` is `min(now + idle, session start + absolute)`, so sliding never extends past the absolute cap. The presented row carries PostgreSQL's `xmin` as a concurrency token. If another request rotated the same row in the meantime, the update fails and the request returns `409`. Two rotations of one token cannot both succeed.
7. Reload roles and rights. Issue a new access token with the same `sid`.
8. Set the rotated cookie and return the body.

### 6.4 Logout (`POST /api/v1/auth/logout`)

1. CSRF guard.
2. Revoke the presented token's **whole family** (`revoked_reason = LOGOUT`), so a token copied from before logout cannot be used.
3. Clear the cookie with a matching `Set-Cookie` (same name, path and attributes, `Max-Age=0`).
4. Return `204`. The client discards the access token from memory.

The access token stays valid until its `exp` (at most 15 minutes by default). This is accepted. Section 6.5 describes the options for immediate effect.

### 6.5 Forced revocation and immediate effect

* **Admin password reset** (`PUT /api/v1/users/{id}/password`): clears the lockout, revokes every family for the user (`revoked_reason = ADMIN_RESET`), and the user signs in again. Implemented.
* **Deactivation:** the next refresh revokes the family (`DEACTIVATED`). Implemented.
* **Immediate access revocation:** not implemented. Options are a `users.security_stamp` column, checked on sensitive operations, or a `jti` denylist for the remaining access-token lifetime. Decision open (section 13).

### 6.6 Cookie-authenticated endpoint protection (CSRF)

`/auth/login`, `/auth/refresh` and `/auth/logout` require **both** of the following. The origin rule depends on the profile:

* **Origin:**
  * Profile A: the `Origin` host must equal the tenant host the edge forwarded (section 6.7), and the scheme must be HTTPS (plain HTTP is allowed in Development only).
  * Profile B: the `Origin` must exactly match an entry in `Cors:AllowedOrigins`, or its host must match an active tenant domain (the same rule as CORS). Anything else returns `403`.
* **Header:** `X-CSRF: 1`. A cross-site form cannot set a custom header, and a custom header forces a CORS preflight for any cross-origin request.

In Profile A, `SameSite=Strict` is the first line of defence. In Profile B, the origin check and the custom header are the only CSRF defence, so they are mandatory.

### 6.7 Tenant resolution and validation

Every `/api` request is bound to exactly one tenant, and the middleware fails closed. The steps:

1. **Edge check** (Profile A with enforcement): the edge identity header must match (section 3.1). Otherwise `403`.
2. **Resolve the request host by profile.** Profile A: the forwarded host from the edge. Profile B: the `Origin` host, matched against active tenant domains. The `Host` header is never a tenancy signal. In Profile B it is the App Service host, and in Profile A it is the edge host.
3. **Fail closed.** If the host does not resolve to an active tenant: `404` for `/api/v1/auth` and `403` for everything else. There is no default tenant.
4. **Authenticated requests:** the JWT `tenant_id` must equal the resolved tenant, or the request is rejected with `403`. This prevents BOLA across tenants.
5. `ITenantContext.TenantId` and `UserId` are set from the resolved tenant and the validated principal only.

Refresh also checks that the stored row belongs to the resolved tenant (step 4 of section 6.3).

### 6.8 Argon2id parameters

Argon2id with `MemorySize = 65536` KiB (64 MiB), `Iterations = 3`, `DegreeOfParallelism = 1`, and a 16-byte salt. These exceed the OWASP minimum (m = 19 MiB, t = 2, p = 1). Verification uses `CryptographicOperations.FixedTimeEquals`. Parameters are reviewed yearly.

---

## 7. Frontend Implementation (`rclimit-ui`)

The project uses a `fetch`-based client in `src/api/client.ts`. `src/contexts/AuthContext.tsx` provides session state, and `src/contexts/authContextValue.ts` holds the types and context object. No HTTP client library is added.

### 7.1 Requirements

* The access token is kept in a module-level variable. It is never written to `localStorage`, `sessionStorage`, or IndexedDB. Nothing in the UI stores a session.
* Requests use `credentials: 'include'`. This is required in Profile B and harmless in Profile A.
* The base URL comes from `getApiBaseUrl()` (`src/config.ts`). It is empty in Profile A and the App Service URL in Profile B, so the same build works in both.
* **Single-flight refresh:** concurrent 401s share one refresh promise.
* **Cross-tab serialisation:** refresh runs inside `navigator.locks.request('rclimit-refresh', …)`, so each refresh sees the cookie written by the previous one. A `BroadcastChannel('rclimit-auth')` carries `login` and `logout` between tabs. A logout in one tab clears the session in the others.
* **Retry once** on a 401 after a successful refresh. Never loop.
* **Startup:** the config loads, then one silent refresh runs. The UI shows a loading state until it finishes, so protected routes do not redirect before the session is known. StrictMode runs the effect twice; the shared refresh promise handles that.

### 7.2 Client (`src/api/client.ts`)

The core of the client, reproduced from the implementation:

```typescript
import { getApiBaseUrl } from '../config';
import type { User } from '../contexts/authContextValue';

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

const url = (path: string) => `${getApiBaseUrl()}${path}`;

// The implementation also notifies subscribers here; that is omitted from this excerpt.
function setSession(token: string, _user: User): void {
  accessToken = token;
}

function clearSession(): void {
  accessToken = null;
}

function postRefresh(): Promise<Response> {
  return fetch(url('/api/v1/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF': '1' },
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
  const body = (await res.json()) as { data: { accessToken: string; user: User } };
  setSession(body.data.accessToken, body.data.user);
  return true;
}

/** Single-flight refresh. Concurrent callers share one request; a Web Lock serialises tabs. */
export function refreshOnce(): Promise<boolean> {
  refreshing ??= (navigator.locks
    ? navigator.locks.request('rclimit-refresh', runRefresh)
    : runRefresh()
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Attaches the access token. On 401, refreshes once and retries. Returns the raw Response. */
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
```

`setSession` and `clearSession` update the token and notify `subscribeSession` listeners, which `AuthContext` uses for React state. `apiFetch<T>`, `apiGet`, `apiPost`, `apiPut` and `apiDelete` wrap `authedFetch` and keep the JSON-and-throw behaviour that the pages already use.

The excerpt is type-checked with `tsc --strict` as part of validating this document, with stubs for `../config` and `../contexts/authContextValue`.

### 7.3 Startup, login and logout

* **Startup:** `AuthProvider` loads config, calls `refreshOnce()`, and only then renders the app.
* **Login:** `loginRequest` posts credentials with `X-CSRF`, sets the session, and broadcasts `login`.
* **Logout:** `logoutRequest` calls the endpoint and clears the session in all cases, then broadcasts `logout`.

### 7.4 Error handling

* A 401 that survives one refresh clears the session. `ProtectedRoute` then sends the user to `/login`.
* Errors use the ProblemDetails `detail` only. Stack traces and internal codes are never shown.

---

## 8. Hardening Requirements

### 8.1 Abuse protection

* **Rate limits (implemented):** login, 20 requests per client IP per 15 minutes; refresh, 120 per client IP per 15 minutes. These are starting values. Tune with production data. Behind the edge, the client IP comes from the edge-supplied `X-Forwarded-For` (section 3.1).
* **Lockout with backoff (implemented as a fixed lock):** 5 consecutive failed passwords lock the account for 15 minutes. The lock response is the same generic `401` as any other failure, so it does not reveal account state. A success clears the count.
* **Generic errors (implemented):** one message for every credential failure, including unknown email, wrong password, locked and inactive accounts.
* **Timing (implemented):** unknown emails are verified against a cached dummy hash.

### 8.2 Passwords (NIST SP 800-63B)

* **Minimum length 12, maximum 128 (implemented):** `PasswordPolicy` applies to user creation and admin reset.
* No composition rules (no forced symbols or digits), and no periodic forced rotation.
* **Not implemented:** breached-password screening (k-anonymity range API) for new passwords and resets.

### 8.3 Browser hardening

* `Content-Security-Policy` at the edge: `default-src 'self'`, no inline script except via hashed or nonced entries, `frame-ancestors 'none'`. Edge work, not yet in place.
* No third-party scripts on pages that handle authentication.

### 8.4 MFA (roadmap)

`users.two_factor_enabled` already exists in the schema. The future design uses TOTP or WebAuthn as a second factor on login, with recovery codes. Once enabled, a session's `amr` claim records the factors used. Out of scope for the current milestone.

---

## 9. Audit Logging

Authentication events are written as structured Serilog entries, with the event name, tenant, user, client IP and family where relevant:

| Event | When |
| :--- | :--- |
| `auth.login.success` | Login succeeded |
| `auth.login.failure` (`reason`: `unknown_account`, `locked`, `inactive`, `bad_password`) | Login refused |
| `auth.refresh.success` | Token rotated |
| `auth.refresh.conflict` | Benign concurrent refresh returned `409` |
| `auth.refresh.reuse_detected` | Reuse outside the grace window. Logged at Warning, the family is revoked |
| `auth.refresh.failure` (`reason`) | Expired, inactive, or tenant mismatch |
| `auth.logout` | Family revoked by logout |
| `auth.password_reset` | Admin reset |

**Never logged:** tokens, the refresh cookie value, password hashes, or request bodies of auth endpoints.

**Not implemented:** an audit table with retention, and audit records for tenant session-policy changes (there is no settings API yet, section 5.4). The structured log entries are the current audit trail.

---

## 10. Security Threat Matrix

| Threat | Vector | Mitigation |
| :--- | :--- | :--- |
| **XSS** | Script reads tokens | Refresh token is `HttpOnly`. Access token is in memory only. No `localStorage`. CSP at the edge (pending). |
| **CSRF** | Cross-site request to a cookie endpoint | Profile A `SameSite=Strict` cookie. Origin and `X-CSRF` checks on login, refresh and logout. |
| **Login CSRF** | Cross-site form logs the victim into the attacker's account | Login requires the `X-CSRF` header and an allowed Origin. |
| **Token theft and replay** | Attacker reuses a copied refresh token | Rotation with reuse detection and family revocation. Access tokens expire in 15 minutes by default. |
| **Refresh race** (multi-tab, StrictMode) | Benign concurrent refresh looks like reuse | 30-second grace returns `409`, not revocation. Web Lock serialises refreshes in the browser. xmin concurrency check on the rotated row. |
| **Session fixation** | Attacker plants a known session before login | A new refresh family and access token are issued at every login. Any pre-login cookie is replaced. |
| **Cross-tenant BOLA** | Request for another tenant's resource | Tenant resolved from the edge host (or Origin in Profile B) and checked against the JWT `tenant_id`. Fail closed. |
| **Cross-tenant cookie leakage** | Tenant A's cookie sent to tenant B | Host-only cookie in Profile A. Partitioned in Profile B. One origin per tenant host. |
| **Brute force and credential stuffing** | Repeated password guesses | Per-IP rate limits, per-account lock after 5 failures, generic errors, Argon2id, timing equalisation. |
| **Account enumeration** | Differences in response between known and unknown accounts | One generic message. Dummy verification for unknown accounts. |
| **Secret leakage** | Signing key or database password in source control | **Open:** see section 11, items 11 and 24. |
| **Algorithm confusion** | Token signed with `none` or a different algorithm | `ValidAlgorithms` pinned to HS256. `ValidTypes` pinned to `at+jwt`. |
| **Stale authorization** | Roles or rights changed while the token is valid | Access tokens last at most 15 minutes by default. Immediate revocation is open (section 6.5). |
| **Session lingering after deactivation** | Deactivated user keeps refreshing | Refresh revokes the family when the user is inactive. Admin deactivation takes effect at the next refresh. |
| **Edge bypass** | Calls straight to the App Service | Edge shared-secret header required in Profile A. App Service network restriction is pending (edge work). |

---

## 11. Gap Analysis and Status

| # | Area | Status | Notes |
| :--- | :--- | :--- | :--- |
| 1 | Refresh token in browser storage | **Done** | Cookie only. `localStorage` removed from the UI. |
| 2 | Refresh token in response body | **Done** | Removed from `AuthBody`. Set only as a cookie. |
| 3 | Silent refresh | **Done** | Single-flight, Web Lock, one retry. |
| 4 | Cookie endpoints | **Done** | Login, refresh and logout use the cookie and CSRF guard. Request bodies no longer carry the refresh token. |
| 5 | Session family | **Done** | Migration 024 adds `family_id`, backfills legacy rows as single-token families. |
| 6 | Absolute session cap | **Done** | `expires_at = min(idle, start + absolute)`. |
| 7 | Reuse detection | **Done** | Family revocation outside a 30-second grace window. `409` inside it. |
| 8 | Active check on refresh | **Done** | Inactive users revoke the family. Tenant match checked. Tenant active is enforced by the middleware. |
| 9 | Configured lifetimes | **Done** | Tenant policy, clamped, cached. `Jwt:*` keys are the platform defaults. |
| 10 | Tenant-specific policy storage | **Done** (storage and provider) | Migration 025. **Open:** the settings API and its UI (section 5.4). |
| 11 | JWT secret in source control | **Open** | `Jwt:Secret` is still committed in `appsettings.json`. Rotate it and move it to the secret store. The code now reads `Jwt__Secret` from the environment when set. |
| 12 | JWT validation | **Done** | Algorithm and `typ` pinned. `sid` issued. `role` and `right` claims kept. |
| 13 | Tenant resolution | **Done** | Profile-based host source. Fail closed. Forwarded host trusted only from the edge. |
| 14 | Login errors | **Done** | One generic message for every credential failure. |
| 15 | Rate limiting and lockout | **Done** | Per-IP limits on login and refresh. Per-account lock after 5 failures. |
| 16 | Password policy | **Partly done** | Minimum 12 in every path, including the UI. Breached-password screening is open. |
| 17 | Admin reset revocation | **Done** | Revokes all families (`ADMIN_RESET`) and clears the lock. |
| 18 | Registration | **Done** | `/auth/register` removed. `POST /api/v1/users` replaces it. |
| 19 | Audit | **Partly done** | Structured `auth.*` log events. An audit table is open. |
| 20 | Edge | **Open** | Profile A cutover (section 3.5) needs the Static Web Apps linked backend or Front Door, plus the edge identity header. |
| 21 | Profile switch | **Done** | `Auth:DeploymentProfile` derives all profile-dependent behaviour. |
| 22 | Profile-dependent cookie and CSRF rules | **Done** | Cookie attributes, CSRF origin rule and tenant host source selected by profile. |
| 23 | Startup configuration validation | **Done** | Fails fast on inconsistent profile settings and weak JWT secrets. |
| 24 | Local database credentials in source control | **Open** | `appsettings.Development.json` contains a database connection string with a password. Rotate it and move it to user secrets or environment variables. |

**Migrations to run:** `024_auth_session_families.sql` and `025_tenant_session_policy.sql`. Both are idempotent, and the runner applies every file in `rclimit-db/migrations` on each run.

---

## 12. Future Hardening

* **Sender-constrained tokens (RFC 9449, DPoP):** bind the access token to a client key so a stolen bearer token cannot be used elsewhere.
* **External authorization server:** move login to a standards-based provider with Authorization Code and PKCE, and remove the password flow from the API.
* **Asymmetric signing keys:** RS256 or ES256 with `kid` rotation, publishing the JWKS.

---

## 13. Open Decisions

1. Edge product for production (Static Web Apps linked backend, or Azure Front Door), and its custom-domain limits.
2. Final lifetime bounds in section 5.1 (the proposed values are starting points) and the rate-limit values in section 8.1.
3. Immediate revocation strategy: security-stamp check, `jti` denylist, or accept the 15-minute window.
4. Whether MFA is required for SuperAdmin before the next milestone.
5. Retention period for audit records, and whether they move to a database table.
6. Breached-password service for section 8.2.
7. Interim expiry date for Profile B, and whether Safari users must be supported until cutover (they cannot silently refresh in Profile B).
8. Headers that the Static Web Apps linked backend forwards to the API, and whether it can add the edge identity header. Tenant resolution in Profile A depends on both.

# User Session & Authentication Architecture Specification

**Status:** Target design. Sections 4 to 9 describe the required end state. Section 11 lists where the current code differs and the work needed to close each gap.

The current deployment runs an **interim cross-site profile (Profile B)**, which is temporary. Section 3.5 is the runbook for switching to the target same-site profile (Profile A). Both profiles run the same code, and the switch is configuration only (section 3.6).

This specification defines session management, token handling, tenant-specific session policy and the multi-tenant authorization model for the **RCLimit** platform.

---

## 1. Goals and Scope

RCLimit is a multi-tenant SPA (`rclimit-ui`) backed by an ASP.NET Core API (`rclimit-backend-api`). The goals are:

* **No token in script-readable storage.** The refresh token is an `HttpOnly` cookie. The access token lives only in module memory.
* **Short-lived access, longer sessions without re-login.** Access tokens last minutes. Refresh rotates silently, within both an idle and an absolute session limit.
* **Stolen refresh tokens are detectable.** Rotation with reuse detection, scoped to the session family.
* **Strict tenant isolation.** Every request is bound to exactly one tenant, and cross-tenant use is rejected.
* **Tenant-controlled session lifetimes** within platform-defined bounds.

Out of scope: the authorization model for rights (see `docs/User_Roles_And_Rights.md`), and MFA (roadmap in section 8).

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

Every tenant host (default host, subdomain such as `acme.rclimit.in`, or a tenant's own custom domain) is served by a single **edge** (reverse proxy or CDN with routing, e.g. Azure Front Door). The edge routes:

* `/` and static assets to the static UI.
* `/api/*` to the API.

The browser therefore talks only to its own host. The cookie is **first-party** and `SameSite=Strict` works as designed.

**Edge requirements**

* **Refresh cookie:** name `__Secure-rclimit_rt`, attributes `Secure; HttpOnly; SameSite=Strict; Path=/api/v1/auth`, and **host-only** (no `Domain` attribute), so one tenant's cookie is never sent to another tenant's host. `Domain=.rclimit.in` is forbidden. The `__Host-` prefix cannot be used because it requires `Path=/`.
* **No CORS in Profile A.** The browser never makes cross-origin calls to the API. Development uses a Vite dev-server proxy for `/api`.
* **Forwarded host:** the edge sets `X-Forwarded-Host` to the host the browser requested. It strips any client-supplied copy. The API accepts `X-Forwarded-Host` only from the edge.
* **Origin lock:** the API accepts requests only from the edge (network restriction on the App Service plus a verified edge-identity header), so the proxy cannot be bypassed.
* **Custom domains:** each tenant domain needs a managed TLS certificate and a verified CNAME at the edge. Check the edge product's current custom-domain limits before onboarding tenants.
* **Transport and headers:** HSTS, TLS 1.2 or higher, request size limits, WAF rules, and security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).

### 3.2 Profile A implementation options

Both options meet the edge requirements in section 3.1.

* **A1: Azure Static Web Apps linked backend (preferred cutover path).** The UI's Static Web App serves `/` and forwards `/api/*` to the existing App Service, so both are on one host. Microsoft's documentation states that the integration requires the **Standard** Static Web Apps plan, that the App Service endpoint must use the `/api` prefix (already true for `/api/v1/*`), that one App Service links to one Static Web App, and that linked backends are not supported on pull-request environments ([Microsoft Learn: API support with Azure App Service](https://learn.microsoft.com/en-au/azure/static-web-apps/apis-app-service)). Before cutover, verify in staging which headers the linked backend forwards to the API, in particular the host and `X-Forwarded-Host`, because tenant resolution depends on them (section 6.7). Custom tenant domains are served by the Static Web App's own custom-domain feature.
* **A2: Azure Front Door (or equivalent) in front of the UI and the API.** Needed if WAF rules, multi-region routing, or custom routing beyond A1 are required. Higher cost and configuration.

The choice between A1 and A2 is open (section 13).

### 3.3 Profile B: interim cross-site (temporary)

Profile B is used only until the cutover in section 3.5. Current hosts:

* UI: `https://ashy-hill-006ad3900.4.azurestaticapps.net`
* API: `https://rclimit-c8ancwfverfdc6ha.indiasouthcentral-01.azurewebsites.net`

Profile B differs from Profile A in these ways:

* **Refresh cookie:** `__Secure-rclimit_rt; Secure; HttpOnly; SameSite=None; Partitioned; Path=/api/v1/auth`. Cross-site requests need `SameSite=None`, which removes the browser's built-in CSRF protection, so the checks in section 6.6 are mandatory. `Partitioned` keys the cookie to the top-level site, so it is not shared between sites.
* **Tenant host source:** the `Origin` header, matched exactly against active tenant domains (`TenantAwareCorsPolicy` already performs this match for CORS). Login and refresh fail closed for unknown tenants. Non-browser clients can forge `Origin`. That only selects which tenant the request addresses. The user must still authenticate in that tenant, and the JWT `tenant_id` check (section 6.7) applies to every API call.
* **CORS:** an exact-origin allowlist with credentials, from `Cors:AllowedOrigins`. Never `*`. Responses set `Vary: Origin`.
* **Browser limits:** Safari blocks third-party cookies and Firefox partitions them by default. In those browsers silent refresh fails, so the access token is lost on page reload and the user signs in again. Chrome's third-party cookie policy has changed several times, so each release must re-test it. These limits are accepted for the interim only.
* **Same code:** Profile B uses the same code paths as Profile A. The only differences are the attribute and source switches listed above, selected by the profile setting (section 3.6).

### 3.4 Browser token-storage options (for reference)

| Option | Status |
| :--- | :--- |
| Token-mediating backend or BFF holding the refresh token | Equivalent to Profile A. Chosen in practice when the edge is the BFF. |
| Refresh token in same-site `HttpOnly` cookie, access token in memory | **Profile A. Normative.** |
| Browser-held tokens in `localStorage` or `sessionStorage` | **Prohibited.** Any XSS reads them. This is the current state (section 11). |

### 3.5 Switching from Profile B to Profile A (runbook)

Both profiles run the same code, so the switch is a sequence of configuration changes. The order keeps the system working at every step.

1. **Release code that supports both profiles.** The API defaults to `Auth:DeploymentProfile = CrossSite`. The UI already reads its API base URL at runtime from `public/config.json`.
2. **Test in staging** with the browser matrix (Chrome, Edge, Safari, Firefox) for: login; reload, which exercises silent refresh; refresh after the access token expires; logout; tenant mismatch (a token for tenant A sent to tenant B's host returns `403`); and a tenant's cookie not being sent to another tenant's host.
3. **Link the backend** (A1, section 3.2) on the production Static Web App while still on Profile B. Confirm that `https://<swa-host>/api/v1/...` responds.
4. **Move the UI onto the same origin.** Set the GitHub secret `API_BASE_URL` to an empty value and redeploy the UI. The API base URL is written into `config.json` at build time, so a redeploy is required. Requests now go to `/api/...` on the Static Web App host. Profile B cookies keep working, and Safari now works because the cookie is first-party. The CSRF origin check still passes, because the Static Web App's origin is already in `Cors:AllowedOrigins`.
5. **Switch the API profile** to `SameSite`. Refresh cookies become `SameSite=Strict` without `Partitioned`, tenant resolution uses the forwarded host, edge enforcement is on (`Edge:Enforce = true`), and `Cors:AllowedOrigins` is cleared.
6. **Restrict direct access** to the App Service so that only the edge can reach it (part of edge enforcement, section 3.1).

Users sign in once after step 4 and again after step 5, because the cookie's host or attributes change. Refresh rows in the database stay valid across both steps.

**Rollback:** reverse step 5 (profile back to `CrossSite`, restore the CORS origins), then step 4 (secret back to the App Service URL, UI redeployed). Both are configuration changes plus a UI redeploy.

### 3.6 Configuration reference

| Setting | Where | Value | Notes |
| :--- | :--- | :--- | :--- |
| `Auth:DeploymentProfile` | API app settings | `CrossSite` (Profile B) or `SameSite` (Profile A) | The single switch. It derives the cookie attributes, the tenant host source, the CSRF rules, and edge enforcement. These are not configurable separately. |
| `Cors:AllowedOrigins` | API app settings | `CrossSite`: the UI origin, e.g. `https://ashy-hill-006ad3900.4.azurestaticapps.net`. `SameSite`: empty. | Checked at startup (below). |
| `Edge:Enforce` | API app settings | Derived from the profile: `SameSite` = `true`, `CrossSite` = `false`. | Development may set it `false` through the Development environment only. |
| `Auth:Cookie:Name` | API app settings | `__Secure-rclimit_rt` | Same name in both profiles. |
| `Jwt:Secret` | Secret store | At least 256 bits | Not in `appsettings.json` (section 11). |
| `API_BASE_URL` | GitHub secret, written to `public/config.json` as `apiBaseUrl` | Profile B: the App Service URL. Profile A: empty (same origin). | Build-time value. Changing it requires a UI redeploy. |

**Startup validation.** The API refuses to start when the settings disagree with the profile: `SameSite` with a non-empty `Cors:AllowedOrigins` or with edge enforcement off (outside Development), or `CrossSite` with an empty `Cors:AllowedOrigins`. A misconfigured deployment should fail at startup, not at the first login.

---

## 4. Token Specification

| Property | Access Token | Refresh Token |
| :--- | :--- | :--- |
| **Format** | Signed JWT, `alg: HS256`, `typ: at+jwt` (RFC 9068) | Opaque: 32 bytes from a CSPRNG, base64url encoded |
| **Signing key** | Secret of at least 256 bits, held in a secret store (not in `appsettings.json`). Asymmetric keys with `kid` rotation are the preferred future state. | Not applicable |
| **Storage (server)** | Not stored. Stateless validation. | SHA-256 hash only, in `auth.refresh_tokens` |
| **Storage (client)** | Module memory only (`hooks/useAuth.ts` context, `api/client.ts` variable) | `HttpOnly` cookie set by the API |
| **Lifetime** | Default **15 minutes**. Tenant-configurable within bounds (section 5). | Idle window default **7 days**, with an absolute cap default **30 days** from session start. Both tenant-configurable within bounds. |
| **Transport** | `Authorization: Bearer <token>` | `Cookie: __Secure-rclimit_rt=<value>`, sent only to `/api/v1/auth/*` |
| **Claims** | `iss`, `aud`, `sub` (user id), `jti`, `iat`, `nbf`, `exp`, `sid` (session family id), `tenant_id`, `email`, `name`, `role` (repeated), `right` (repeated) | N/A |
| **Validation** | Verify signature, `iss`, `aud`, `exp`, `nbf`; `ClockSkew = 0`; pin `ValidAlgorithms = [HS256]` | Lookup by hash; check `revoked_at`, `expires_at`, tenant active, user active |

Claim names match the current `JwtTokenService.cs` (`ClaimTypes.Role` serialises as `role`; rights use the custom claim `right`). `sid` is new and is required for session-level revocation checks. Adding `typ: at+jwt` and `aud` enforcement is a planned change (section 11).

---

## 5. Tenant-Specific Session Policy

Each tenant can tune its session lifetimes within platform bounds. A tenant that does not set a value uses the platform default.

### 5.1 Settings

| Field | Meaning | Platform default | Allowed range |
| :--- | :--- | :--- | :--- |
| `access_token_minutes` | Access token lifetime | 15 | 5 to 60 |
| `idle_timeout_days` | Refresh token sliding window, reset on each successful refresh | 7 | 1 to 30 |
| `absolute_timeout_days` | Maximum session length from the initial login, regardless of activity | 30 | 1 to 90, and at least `idle_timeout_days` |
| `max_sessions_per_user` | Optional cap on concurrent sessions per user (oldest family revoked when exceeded) | unlimited | 1 to 50 or unlimited |

### 5.2 Storage and resolution

* Settings are stored in **`system.tenant_settings`** (`rclimit-db/migrations/002_system_tenants.sql`), as nullable columns with `CHECK` constraints that match the ranges above. The schema change is a numbered migration (not yet written).
* Platform defaults and bounds come from the `Jwt` configuration section. The existing unused keys `AccessTokenExpirationMinutes` and `RefreshTokenExpirationDays` become the default source. Bounds live in code next to the policy class.
* A new `ITenantSessionPolicyProvider` reads the settings with a 5-minute in-memory cache, modelled on `TenantDirectory`. A settings change evicts the cache entry for that tenant. Values are clamped to the allowed ranges, so an out-of-range database value cannot weaken security.

### 5.3 Application rules

* Login and refresh read the tenant policy and set:
  * access token `exp = now + access_token_minutes`;
  * refresh token `expires_at = min(now + idle_timeout_days, session_started_at + absolute_timeout_days)`;
  * cookie `Expires` equal to the refresh token's `expires_at`.
* JWT validation needs no change because it reads `exp`.
* **Timing:** changes apply to tokens issued after the change. A shorter idle window takes effect at each user's next refresh. For immediate effect, revoke the tenant's sessions (section 6.5).

### 5.4 Editing

Only users with a new right, `tenant.settings.manage`, can change session settings, through a SuperAdmin-only settings API. Each change writes an audit record (section 9). The UI screen is a follow-up task.

---

## 6. Backend Endpoints and Handler Behaviour (.NET 10)

```
[ Browser ] ── same origin ──► [ Edge ] ──► [ API ]
     │                                         │
     ├─ POST /api/v1/auth/login ───────────────► LoginCommandHandler
     │     ◄─ 200 JSON { accessToken, expiresAt, user }   (no refresh token in body)
     │     ◄─ Set-Cookie __Secure-rclimit_rt (HttpOnly, Path=/api/v1/auth)
     │
     ├─ GET /api/v1/... (Bearer) ──────────────► TenantMiddleware ► Controller
     │
     └─ POST /api/v1/auth/refresh (cookie + X-CSRF header) ─► RefreshTokenCommandHandler
           ◄─ 200 JSON { accessToken, expiresAt, user }
           ◄─ Set-Cookie (rotated refresh token)
```

### 6.1 Response envelope and caching

All auth responses use the existing HATEOAS envelope (`HateoasResponse<T>`, with the payload under `data`). Every auth response sets `Cache-Control: no-store`.

The refresh token is **never** in a response body. The current `AuthResponse` record includes `RefreshToken`, which must be removed (section 11).

### 6.2 Login (`POST /api/v1/auth/login`)

1. Resolve the tenant from the forwarded host (section 6.7). Fail closed if the tenant is unknown or inactive.
2. Apply rate limits and lockout (section 8.1) **before** any password check.
3. Verify the password with Argon2id (`Argon2PasswordHasher`). Verify with the same generic error for unknown email, wrong password, inactive user, and missing hash. The message is always `Invalid email or password.`
4. Create a session family: a new `family_id` and `session_started_at = now`.
5. Load the tenant session policy (section 5) and compute `expires_at`.
6. Generate the refresh token (32 CSPRNG bytes), store its SHA-256 hash with `family_id`, `tenant_id`, `user_id`, `session_started_at`, `expires_at`, `ip_address`, and `user_agent`.
7. Issue the access token (section 4) with `sid = family_id`.
8. Set the cookie:

```csharp
Response.Cookies.Append("__Secure-rclimit_rt", rawRefreshToken, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,
    Expires = refreshExpiresAt,
    Path = "/api/v1/auth",
    IsEssential = true
});
```

The values shown are Profile A. Profile B uses `SameSite = SameSiteMode.None` and `Partitioned` (section 3.3). If the ASP.NET Core version in use does not expose `Partitioned` on `CookieOptions`, append the attribute to the `Set-Cookie` header directly.

### 6.3 Refresh and rotation (`POST /api/v1/auth/refresh`)

1. Apply the CSRF checks for the active profile (section 6.6). Otherwise return `403`.
2. Read the cookie. If absent, return `401`.
3. Look up the row by hash. If it does not exist, return `401`.
4. Check the tenant is active and the user is active. If not, revoke the family and return `401`. **This check is missing today** (section 11).
5. Classify the presented token:
   * **Active** (not revoked, not expired): continue to step 6.
   * **Expired** (`expires_at` passed, not revoked): revoke the family, return `401`.
   * **Rotated, within the grace window** (`revoked_at` less than 30 seconds ago, `revoked_reason = ROTATED`): this is a benign concurrent refresh, typically from another tab or React StrictMode. Return `409 Conflict`. Do **not** revoke anything. The client retries with the cookie that the winning request set.
   * **Rotated, after the grace window**, or revoked for any other reason: treat as **reuse**. Revoke every token in the family (`sid`), write a security audit event, return `401`.
6. Rotate: mark the presented row `revoked_at = now`, `revoked_reason = ROTATED`, `last_used_at = now`, and set `replaced_by_token_id` to the new row. Create the new row in the same family. Its `expires_at` is the **same** as the family's computed limit, so sliding never extends past the absolute cap.
7. Reload roles and rights, and issue a new access token with the same `sid`.
8. Set the rotated cookie and return the response.

Both the revoke and the insert happen in one database transaction, so a failure leaves the old token valid rather than producing two live tokens without a record.

### 6.4 Logout (`POST /api/v1/auth/logout`)

1. Require the CSRF header and a valid `Origin`.
2. Revoke the presented token's **whole family** (`revoked_reason = LOGOUT`), so a token copied from before logout cannot be used.
3. Expire the cookie with the same name, `Path`, `Secure`, `HttpOnly`, and `SameSite`, via `Response.Cookies.Delete` with matching options.
4. Return `204`. The client discards the access token from memory.

The access token stays valid until its `exp` (at most 15 minutes by default). This is accepted. Section 6.5 describes the options for immediate effect.

### 6.5 Forced revocation and immediate effect

* **Admin password reset:** revoke every family for the user (`revoked_reason = ADMIN_RESET`), then the user must sign in again.
* **Deactivation or tenant disablement:** revoke all families, and check `IsActive` and tenant status on every refresh.
* **Immediate access revocation (optional):** add a `users.security_stamp` column (a random value replaced on any credential or role change). The API compares the token's stamp claim against the database on sensitive operations, or a short-lived `jti` denylist covers the remaining access-token lifetime. Decide which before implementation (section 13).

### 6.6 Cookie-authenticated endpoint protection (CSRF)

`/auth/refresh` and `/auth/logout` authenticate with the cookie alone, so the Bearer header does not protect them. They require **both** of the following, and the origin rule depends on the profile:

* an `Origin` header that matches the profile. Profile A: equal to the request's own origin. Profile B: exactly one of the entries in `Cors:AllowedOrigins`. Anything else returns `403`.
* a custom header, `X-CSRF: 1`, which a cross-site form cannot set and which forces a CORS preflight for any cross-origin request.

Where the browser sends `Sec-Fetch-Site`, it should be `same-origin` in Profile A and `cross-site` only with an allowlisted `Origin` in Profile B. In Profile A, `SameSite=Strict` is the first line of defence. In Profile B, the origin check and the custom header are the only CSRF defence, so they are mandatory.

### 6.7 Tenant resolution and validation

The current `TenantMiddleware` resolves the tenant through `ITenantDirectory` and checks the JWT `tenant_id` against it. The required behaviour is:

1. **Resolve the request host by profile.** Profile A: the forwarded host from the edge (section 3.1). Profile B: the `Origin` header, matched exactly against active tenant domains (section 3.3). The `Host` header is never a tenancy signal. In Profile B it is the App Service host, and in Profile A it is the edge host. In Profile A, `Origin` is never used for tenancy.
2. **Fail closed.** If the host does not resolve to an active tenant, return `404` for auth endpoints and `403` for API calls. Never fall back to a default tenant.
3. **Authenticated requests:** the JWT `tenant_id` is authoritative. It must equal the resolved host's tenant, or the request is rejected with `403`. This prevents BOLA across tenants.
4. Set `ITenantContext.TenantId` and `UserId` from the validated principal only.

### 6.8 Argon2id parameters

Argon2id with `MemorySize = 65536` KiB (64 MiB), `Iterations = 3`, `DegreeOfParallelism = 1`, and a 16-byte salt. These exceed the OWASP minimum (m = 19 MiB, t = 2, p = 1). Verification uses `CryptographicOperations.FixedTimeEquals`. Parameters are reviewed yearly.

---

## 7. Frontend Implementation (`rclimit-ui`)

The project uses a `fetch` wrapper (`src/api/client.ts`) and `hooks/useAuth.ts` with `contexts/authContextValue.ts`. No HTTP client library is added.

### 7.1 Requirements

* The access token is kept in a module-level variable. It is never written to `localStorage`, `sessionStorage`, or IndexedDB.
* Requests use `credentials: 'include'`. This is required in Profile B and harmless in Profile A.
* The base URL comes from `getApiBaseUrl()` (`src/config.ts`). It is empty in Profile A and the App Service URL in Profile B, so the same build works in both.
* Single-flight refresh: concurrent 401s share one refresh promise.
* Cross-tab coordination: refresh runs inside `navigator.locks.request('rclimit-refresh', …)` so only one tab refreshes at a time. A `BroadcastChannel('rclimit-auth')` tells other tabs about login and logout.
* Retry once on a 401 after a successful refresh. Never loop.
* Startup: one refresh attempt through the cookie. Under React StrictMode the effect runs twice, so the single-flight promise handles it.

### 7.2 Client (`src/api/client.ts`)

```typescript
import { getApiBaseUrl } from '../config';

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

interface RefreshEnvelope {
  data: { accessToken: string };
}

function postRefresh(): Promise<Response> {
  return fetch(`${getApiBaseUrl()}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF': '1' },
  });
}

async function runRefresh(): Promise<boolean> {
  let res = await postRefresh();
  if (res.status === 409) {
    // Another request rotated the token; the browser now holds the new cookie. Retry once.
    res = await postRefresh();
  }
  if (!res.ok) {
    setAccessToken(null);
    return false;
  }
  const body = (await res.json()) as RefreshEnvelope;
  setAccessToken(body.data.accessToken);
  return true;
}

/** Single-flight, cross-tab refresh. Concurrent callers share one request. */
export function refreshOnce(): Promise<boolean> {
  refreshing ??= navigator.locks
    .request('rclimit-refresh', runRefresh)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Attaches the access token and retries once after a successful refresh. */
export async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, credentials: 'include' });
  if (res.status === 401 && !retried && (await refreshOnce())) {
    return apiFetch(path, init, true);
  }
  return res;
}
```

The snippet is type-checked with `tsc --strict` as part of validating this document. `path` is relative to the API base URL: empty in Profile A, the App Service origin in Profile B (section 3.6).

### 7.3 Startup and login

* Startup calls `refreshOnce()`. On success, the user object comes from the response. On failure, the UI shows the login page.
* Login posts credentials, sets the access token, and broadcasts `login`.
* Logout calls the logout endpoint, clears the token, and broadcasts `logout`. Other tabs redirect to login when they receive the message.

### 7.4 Error handling

* A 401 that survives one refresh clears auth state and redirects to `/login`, with the path preserved in a `returnTo` query parameter (validated as same-origin).
* Error messages use the ProblemDetails `detail` only. Stack traces and internal codes are never shown.

---

## 8. Hardening Requirements

### 8.1 Abuse protection

* **Rate limits:** login and refresh are limited per IP and per account. Proposed starting point: 10 login attempts per email and per IP per 15 minutes. Tune with production data.
* **Lockout with backoff:** after repeated failures, the account is locked for an increasing period. Lockout must not reveal whether the email exists, and must not block the legitimate user indefinitely. Use a temporary delay, not a permanent lock.
* **Generic errors:** one message for all credential failures, including inactive accounts (today's `Account is deactivated.` message reveals account state and must change).

### 8.2 Passwords (NIST SP 800-63B)

* Minimum length **12** (800-63B requires at least 8 when used as a single factor; RCLimit requires more). Maximum length of at least 64, and all printable characters accepted.
* No composition rules (no forced symbols or digits), and no periodic forced rotation.
* Screen new passwords and resets against a breached-password list (k-anonymity range API).
* Current `PasswordPolicy` enforces 8 characters; this must rise to 12 (section 11).

### 8.3 Browser hardening

* `Content-Security-Policy` at the edge: `default-src 'self'`, no inline script except via hashed or nonced entries, `frame-ancestors 'none'`.
* No third-party scripts on pages that handle authentication.

### 8.4 MFA (roadmap)

`users.two_factor_enabled` already exists in the schema. The future design uses TOTP or WebAuthn as a second factor on login, with recovery codes. Once enabled, a session's `amr` claim records the factors used. This is out of scope for the current milestone.

---

## 9. Audit Logging

Log these events to the audit trail with the request's correlation id, tenant id, user id, IP, and user agent:

* login success and failure (with the reason code, never the password), lockout, and unlock;
* refresh success, refresh conflict (409), and **reuse detected** (high severity);
* logout, family revocation, admin revocation, password change or reset;
* tenant session-policy changes, with before and after values.

**Never log** tokens, refresh cookie values, password hashes, or the request body of auth endpoints. Serilog destructuring must exclude these fields.

---

## 10. Security Threat Matrix

| Threat | Vector | Mitigation |
| :--- | :--- | :--- |
| **XSS** | Script reads tokens | Refresh token is `HttpOnly`. Access token is in memory only. No `localStorage`. CSP at the edge. |
| **CSRF** | Cross-site request to a cookie endpoint | Profile A same-site `SameSite=Strict` cookie. Required `Origin` and `X-CSRF` checks on cookie endpoints. |
| **Token theft and replay** | Attacker reuses a copied refresh token | Rotation with reuse detection and family revocation. Access tokens expire in 15 minutes by default. |
| **Refresh race** (multi-tab, StrictMode) | Benign concurrent refresh looks like reuse | 30-second grace window returns `409`, not revocation. Single-flight client and Web Locks. |
| **Session fixation** | Attacker plants a known session before login | A new refresh family and access token are issued at every login. Any pre-login cookie is replaced. |
| **Cross-tenant BOLA** | Request for another tenant's resource | Tenant resolved from the edge host and checked against the JWT `tenant_id`. Fail closed. |
| **Cross-tenant cookie leakage** | Tenant A's cookie sent to tenant B | Host-only cookie, no `Domain` attribute, one origin per tenant host. |
| **Brute force and credential stuffing** | Repeated password guesses | Per-IP and per-account rate limits, backoff lockout, generic errors, Argon2id. |
| **Secret leakage** | Signing key in source control | Key moved to a secret store. Committed secret rotated. Key never logged. |
| **Algorithm confusion** | Token signed with `none` or a different algorithm | `ValidAlgorithms` pinned to HS256 (or the chosen asymmetric algorithm). |
| **Stale authorization** | Roles or rights changed while the token is valid | Access tokens last at most 15 minutes by default. Forced revocation on sensitive changes (section 6.5). |
| **Session lingering after deactivation** | Deactivated user keeps refreshing | `IsActive` and tenant status checked on every refresh, and families revoked on deactivation. |

---

## 11. Gap Analysis and Migration Checklist

This table lists the current state (verified against the code) and the work needed to reach the target design.

| # | Area | Current state | Target | Affected files |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Refresh token storage in browser | `localStorage` (`rclimit_refresh`, `rclimit_token`) | `HttpOnly` cookie, access token in memory | `rclimit-ui/src/contexts/AuthContext.tsx`, `rclimit-ui/src/api/client.ts` |
| 2 | Refresh token in response body | `AuthResponse` includes `RefreshToken`, returned as JSON | Cookie only | `Modules/Identity/.../Application/Dtos/AuthResponse.cs`, `LoginCommandHandler.cs`, `RegisterCommandHandler.cs`, `RefreshTokenCommandHandler.cs`, `AuthController.cs` |
| 3 | Silent refresh | UI never calls `/auth/refresh`; a 401 logs the user out after 15 minutes | Single-flight refresh with one retry | `rclimit-ui/src/api/client.ts` |
| 4 | Cookie endpoints | No cookie is set or read. `refresh` and `logout` take the refresh token from a JSON body (`RefreshRequest`) | Cookie with the section 6.2 attributes; CSRF checks on refresh and logout; body parameter removed | `AuthController.cs`, `LogoutCommand.cs`, `RefreshTokenCommand.cs` |
| 5 | Session family | Refresh rows have no family | `family_id` and family-wide revocation | `rclimit-db/migrations/003_auth_users.sql` (new numbered migration) |
| 6 | Absolute session cap | Refresh expires 7 days after each refresh (sliding forever) | `expires_at` capped by `session_started_at + absolute_timeout_days` | `LoginCommandHandler.cs`, `RefreshTokenCommandHandler.cs` |
| 7 | Reuse detection | Revokes all tokens for the user; no grace window | Family revocation, 30-second grace returning `409` | `RefreshTokenCommandHandler.cs` |
| 8 | Active check on refresh | `RefreshTokenCommandHandler` does not check `IsActive`; login does | Check user and tenant status on refresh | `RefreshTokenCommandHandler.cs` |
| 9 | Configured lifetimes | `AccessTokenExpirationMinutes` and `RefreshTokenExpirationDays` are defined in `appsettings.json` but never read. 15 minutes and 7 days are hard-coded | Read from the tenant policy provider (section 5) | `appsettings.json`, `JwtTokenService.cs`, login and refresh handlers |
| 10 | Tenant-specific policy | Does not exist | `system.tenant_settings` columns, `ITenantSessionPolicyProvider`, settings API | `rclimit-db/migrations/002_system_tenants.sql` (new numbered migration), `Modules/System` |
| 11 | JWT secret | Committed in `appsettings.json` (`Jwt:Secret`) | Secret store; rotate the committed value | `appsettings.json`, `Program.cs` |
| 12 | JWT validation | No `ValidAlgorithms` pinning; no `typ` check; no `aud` in the issued token beyond the config value | Pinned algorithm, `typ: at+jwt`, `sid` | `JwtTokenService.cs`, `Program.cs` |
| 13 | Tenant resolution | Origin header first, then Host; no fail-closed for an unresolved host on authenticated routes | Forwarded host from the edge only; fail closed | `TenantMiddleware.cs`, `TenantDirectory.cs` |
| 14 | Login errors | "Account is deactivated." reveals account state | Generic credential error | `LoginCommandHandler.cs` |
| 15 | Rate limiting and lockout | None | Per-IP and per-account limits, backoff | `Program.cs` (rate limiter middleware) |
| 16 | Password policy | `PasswordPolicy` (used by `CreateUserCommand` and `ResetUserPasswordCommand`) enforces 8 characters. `RegisterCommandHandler` performs no password check at all. No breached-password check | One policy, enforced in every password path: minimum 12, breached-password check | `Modules/Identity/.../Users/PasswordPolicy.cs`, `Modules/Identity/.../Commands/RegisterCommandHandler.cs` |
| 17 | Admin reset revocation | `ResetUserPasswordCommand` revokes all user refresh tokens | Revoke all families, record `ADMIN_RESET` | `Modules/Identity/.../Users/ResetUserPasswordCommand.cs` |
| 18 | Registration | `/auth/register` is locked to `users.manage` (done) | Keep. Admin-created accounts only | `AuthController.cs` |
| 19 | Audit | No auth events recorded beyond Serilog request logs | Audit records per section 9 | New audit table or sink |
| 20 | Edge | Profile B: UI and API on separate hosts (interim) | Profile A cutover per section 3.5 (linked backend A1, or Front Door A2) | Infrastructure, `.github/workflows/azure-static-web-apps-ashy-hill-006ad3900.yml` (`API_BASE_URL` secret) |
| 21 | Profile switch | Does not exist. The API base URL is a build-time value only | `Auth:DeploymentProfile` setting that derives all profile-dependent behaviour (section 3.6) | `Program.cs`, new `Auth` options class, `appsettings.json` |
| 22 | Profile-dependent cookie and CSRF rules | Not implemented | Cookie attributes, origin checks and tenant host source selected by profile (sections 3.3, 6.2, 6.6, 6.7) | `AuthController.cs`, `TenantMiddleware.cs`, login and refresh handlers |
| 23 | Startup configuration validation | None | Fail fast when the profile and its settings disagree (section 3.6) | `Program.cs` |

Items 1 to 4 and 6 to 9 are required in both profiles. Item 20 is required only for the Profile A cutover (section 3.5). Profile B works without it, with the limits in section 3.3.

---

## 12. Future Hardening

* **Sender-constrained tokens (RFC 9449, DPoP):** bind the access token to a client key so a stolen bearer token cannot be used elsewhere.
* **External authorization server:** move login to a standards-based provider with Authorization Code and PKCE, and remove the password flow from the API.
* **Asymmetric signing keys:** RS256 or ES256 with `kid` rotation, publishing the JWKS.

---

## 13. Open Decisions

1. Edge product for production (Azure Front Door or an alternative), and its custom-domain limits.
2. Final lifetime bounds in section 5.1 (the proposed values are starting points).
3. Immediate revocation strategy: security-stamp check, `jti` denylist, or accept the 15-minute window.
4. Whether MFA is required for SuperAdmin before the next milestone.
5. Retention period for audit records.
6. Cutover architecture: A1 (Static Web Apps linked backend, Standard plan cost) or A2 (Azure Front Door). The choice decides the cutover steps in section 3.5.
7. Interim expiry date for Profile B, and whether Safari users must be supported until cutover (they cannot silently refresh in Profile B).
8. Headers that the Static Web Apps linked backend forwards to the API, confirmed in staging. Tenant resolution in Profile A depends on this.

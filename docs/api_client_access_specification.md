# API Client Access Specification (non-browser clients)

**Status:** Plan only. Nothing in this document is implemented yet. It records the design so it can be reviewed and then built in phases (section 11).

This specification extends `docs/user_session_architecture_specification.md`. That document defines the browser session: an `HttpOnly` refresh cookie, the `X-CSRF` and `Origin` guard, and a tenant host taken from `X-Forwarded-Host` or `Origin`. This document defines how clients that are **not browsers** (native apps, CLIs, server-to-server integrations) authenticate and resolve their tenant.

---

## 1. Goals and Scope

* **Any client can consume the API** without browser mechanisms: no cookies, no `Origin`, no CSRF header, no forwarded host.
* **The browser path does not change.** Cookies, the CSRF guard and host-based tenant resolution stay as specified.
* **Tenant isolation is unchanged.** Every request is still bound to exactly one tenant.
* **Reuse the existing session machinery:** session families, refresh rotation, reuse detection, lockout, rate limits and audit events.

Client types in scope:

| Client | Credential | Phase |
|---|---|---|
| Native or mobile app, CLI (acts as a user) | Email and password, then a refresh token | 1 |
| Server-to-server integration (acts as a machine) | Client id and secret, or an API key | 3 |

Out of scope: MFA (see section 8.4 of the session spec), and replacing the password flow with an external authorization server (session spec section 12).

---

## 2. Principles

1. **Never weaken the browser path.** The cookie, CSRF and `Origin` checks stay on every cookie-authenticated endpoint.
2. **No ambient credentials, so no CSRF.** The token path never reads cookies. The client sends the credential explicitly, so there is nothing for a cross-site page to ride on. CORS is irrelevant to these clients.
3. **Never infer the tenant from a client-controlled value on a cookie-authenticated request.** A tenant named in a request body is accepted only on the token login endpoint, where the credentials are then verified inside that tenant.
4. **Fail closed and fail the same way.** An unknown tenant, unknown email, wrong password, locked account and inactive account all return the same generic `401` on the token endpoints.

---

## 3. Token-Client Auth Endpoints

New endpoints in `AuthController` (`rclimit-backend-api/src/Modules/Identity/.../Controllers/AuthController.cs`). They sit beside the cookie endpoints and share the same command handlers. Only the transport differs: the refresh token travels in the body and not in `Set-Cookie`.

| Endpoint | Request body | Response |
|---|---|---|
| `POST /api/v1/auth/token` | `{ tenant, email, password, deviceId }` | `{ accessToken, expiresAt, refreshToken, refreshTokenExpiresAt, user }` |
| `POST /api/v1/auth/token/refresh` | `{ refreshToken }` | Same shape, with a rotated refresh token |
| `POST /api/v1/auth/token/revoke` | `{ refreshToken }` | `204`. Revokes the whole session family |

Rules:

* **No CSRF guard and no `Origin` check** on these endpoints. They do not read the refresh cookie.
* **Reuse the handlers.** `LoginCommand`, `RefreshTokenCommand` and `LogoutCommand` (`Identity.Application/Commands`) and `AuthResponse` are used as they are. The controller returns `AuthResponse.RefreshToken` in the body instead of calling `SetRefreshCookie`.
* **Rotation and reuse detection are identical** to the cookie flow (session spec section 6.3): rotated tokens are single-use, a replay after the grace window revokes the family, and a concurrent refresh inside `Auth:Session:ReuseGraceSeconds` returns `409` and revokes nothing.
* **Responses use the existing `HateoasResponse<T>` envelope** and set `Cache-Control: no-store`.
* **Rate limits.** Two new policies modelled on `auth-login` and `auth-refresh` in `Program.cs`. Because there is no `Origin` check to slow an attacker, login is limited both per client IP and per tenant and email.
* **Lockout.** The existing lockout (5 failures, 15 minutes) applies unchanged.
* **Session policy.** The tenant's session lifetimes and session cap (session spec section 5) apply the same way.

The browser's `POST /api/v1/auth/login` is unchanged and still never returns the refresh token in a body (session spec section 6.1). The token endpoints are a deliberate, separate exception for clients that have no `HttpOnly` cookie jar.

---

## 4. Tenant Resolution for Token Clients

| Step | Rule |
|---|---|
| Token login | `tenant` in the body is a slug or code. It is resolved through `ITenantDirectory`, and the credentials are verified inside that tenant only. |
| Authenticated calls | `TenantMiddleware` takes the tenant from the validated JWT `tenant_id` claim. No host or `Origin` is required. |
| Browser requests | Unchanged: the tenant host comes from the active profile (`RequestHostResolver.TenantHost`), and the JWT `tenant_id` must equal the resolved tenant. |

How `TenantMiddleware` tells the two apart: a request is a token-client request when it is Bearer-authenticated and carries no host or `Origin` signal for the browser profile. The exact discriminator (a claim such as `client_type=token` in the access token, or a distinct route group) is an open decision (section 12). A claim issued by the server is preferred, because the client cannot forge it.

Cross-tenant protection stays intact: the token's `tenant_id` is server-issued and signed, so a token client cannot reach another tenant's data. Refresh also checks that the stored token row belongs to the tenant in the access token (session spec section 6.3, step 4).

---

## 5. Edge and Network

* The edge shared secret (`Auth:Edge`) stays enforced where it is enabled. Token clients call the same edge hostname as the browser app and must pass whatever the edge requires.
* Token clients do not need `X-Forwarded-Host`. The edge may still set it, and it is ignored on the token path.
* TLS is mandatory in every environment except local Development.

---

## 6. Client Storage Guidance

| Platform | Where to keep the refresh token |
|---|---|
| iOS | Keychain, with accessibility `AfterFirstUnlockThisDeviceOnly` |
| Android | Keystore-backed encrypted storage |
| Desktop and CLI | The OS credential store (Windows Credential Manager, macOS Keychain, libsecret) |
| Servers | A secrets manager. Never environment files committed to source |

Never log tokens, never store them in plain files or shared preferences, and keep the access token in memory only.

---

## 7. Machine-to-Machine Access (Phase 3)

A separate principal type, not a user login:

* **Credential:** a client id plus a secret, or an API key. Stored hashed (SHA-256 for high-entropy keys). Shown once on creation.
* **Scope:** per tenant, with an explicit list of rights. It cannot exceed what an admin grants, and it never inherits a user's rights.
* **Token:** a client-credentials style endpoint (`POST /api/v1/auth/client-token`) that issues a short-lived access token with `client_type=machine`. There is no refresh token, because the client re-authenticates with its secret.
* **Lifecycle:** rotatable, revocable, with last-used tracking and an expiry date.
* **Audit:** every issue, use of a privileged right, and revocation is logged against the client id.

---

## 8. Hardening

* **Device binding.** `deviceId` is stored on the session family. Users can list their devices and revoke one. A refresh from a different `deviceId` is rejected and logged.
* **Attestation (optional).** App Attest on iOS and Play Integrity on Android for public mobile apps, checked at token login.
* **Short access tokens.** The 15-minute default stays.
* **Sender-constrained tokens.** DPoP (RFC 9449) is the natural next step (session spec section 12). It binds a token to a client key so a stolen token cannot be replayed from another device.
* **Audit events.** `auth.token.issued`, `auth.token.refreshed`, `auth.token.reuse_detected`, `auth.token.revoked`. They follow the format in session spec section 9.

---

## 9. Local Development and Testing

* Swagger UI calls the API directly. It sends no `X-Forwarded-Host`, and browsers add no `Origin` on same-origin GETs. Browser-profile tenant resolution therefore cannot work from Swagger.
* The token endpoints work from Swagger, curl and Postman with nothing but the JSON body, and every call after login needs only the Bearer token. They are the easiest way to exercise the API without the Vite UI.
* For the browser flow, use the Vite UI at `http://anna-finance.localhost:5173`, as set out in `rclimit-ui/vite.config.ts`.
* `CsrfHeaderTransformer.cs` already declares `X-CSRF` on `/api/v1/auth/*` operations for Swagger. If browser-profile calls from Swagger are still wanted, declare `X-Forwarded-Host` the same way.

---

## 10. Threat Matrix (changes from the session spec)

| Threat | Mitigation |
|---|---|
| Refresh token stolen from device storage | Platform secure storage. Rotation with reuse detection. Device binding. Optional DPoP |
| Refresh token replay | Single-use rotation. A replay after the grace window revokes the whole family and logs `auth.token.reuse_detected` |
| Tenant spoofing through the body `tenant` field | It is accepted only at token login, where the credentials are checked inside that tenant. Later calls use the signed `tenant_id` claim |
| Credential stuffing without `Origin` protection | Per-IP and per-tenant-and-email rate limits, lockout, identical failure responses |
| Token endpoints used from a hostile web page | No ambient credentials, so there is nothing to ride on. Rate limits still apply |
| Leaked machine credential | Hashed storage, scoped rights, rotation, expiry, last-used tracking, audit |

---

## 11. Implementation Phases and Status

| Phase | Work | Status |
|---|---|---|
| 1 | `POST /auth/token`, `/auth/token/refresh`, `/auth/token/revoke`. Rate-limit policies. Tenant-from-JWT branch in `TenantMiddleware`. Tests for rotation, reuse, lockout and tenant isolation | Planned |
| 2 | Device binding and device list. Audit events. Optional per-tenant switch to disable token clients | Planned |
| 3 | Machine principals, client-credentials endpoint, API-key management UI and rights scoping | Planned |

---

## 12. Open Decisions

1. First client type to support: a mobile app (Phase 1 as written) or server-to-server (Phase 3 first).
2. Tenant identifier format at token login: the tenant slug or a separate short code.
3. Whether `deviceId` is mandatory at token login.
4. How `TenantMiddleware` detects a token-client request: a `client_type` claim (preferred) or a separate route group.
5. API keys versus OAuth client credentials for machine access.
6. Whether a tenant setting can disable token clients entirely, and its default.
7. Whether refresh tokens for token clients use longer or different lifetimes than browsers.

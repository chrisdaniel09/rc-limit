# Gaps: Tenancy and system

Scope: tenant creation, tenant resolution, custom domains, tenant settings and the session policy.

Paths are relative to `rclimit-backend-api/src/Modules/System/` unless shown otherwise.

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| TS1 | High | Any signed-in user can list every tenant and read any tenant by id. Neither endpoint checks a right or the caller's tenant. | `RCLimit.Modules.System.Infrastructure/Controllers/TenantsController.cs` lines 17–46; `RCLimit.Modules.System.Application/Queries/GetTenantsQuery.cs` lines 14–23 |
| TS2 | High | Tenant creation has no right check. Any signed-in user of any tenant can create a tenant. | `Infrastructure/Controllers/TenantsController.cs` lines 48–65 |
| TS3 | High | Custom domains are not verified. Whoever can create a tenant can claim any domain, and that domain then routes requests, grants CORS and passes the CSRF origin check. | `Application/Commands/CreateTenantCommand.cs` line 21; `RCLimit.Modules.System.Infrastructure/TenantDirectory.cs` lines 36–46; `RCLimit.BuildingBlocks.Infrastructure/TenantAwareCorsPolicy.cs` lines 31–37 |
| TS4 | Medium | Vendor API keys and gateway credentials are stored in plain text. The Vahan key is a text column and the gateway credentials are a JSON column, with no encryption. | `Domain/Entities/TenantSettings.cs` lines 9–10; `rclimit-db/migrations/002_system_tenants.sql` lines 19–20 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| TS5 | High | The tenant create command validates nothing: no name check, no slug-format check, no custom-domain format check. Only the length and uniqueness constraints in the database apply. | `Application/Commands/CreateTenantCommand.cs` lines 15–28; `rclimit-db/migrations/002_system_tenants.sql` lines 3–7 |
| TS6 | Low | Tenant settings have no write API. The fields `MaxActiveDealers` and `AllowWhatsappIntake` are defined but never read. **(spec)** settings write API. | `Domain/Entities/TenantSettings.cs` lines 7–8 |
| TS7 | Low | The session policy is clamped in code and by database checks (good). The policy cache's invalidate method is never called, which is latent until a settings path exists. | `Infrastructure/TenantSessionPolicyProvider.cs` lines 37–44, 50; `rclimit-db/migrations/025_tenant_session_policy.sql` lines 11–37 |

## Missing features and bugs

| # | Severity | Gap | Evidence |
|---|---|---|---|
| TS8 | Medium | Tenant creation seeds only the tenant and its settings row. It creates no roles, rights, admin user or ledger accounts, so a new tenant cannot sign in or post until someone seeds it by hand. | `Application/Commands/CreateTenantCommand.cs` lines 24–27 |
| TS9 | Medium | Tenant resolution caches misses. A host that is not found is cached as "no tenant" for five minutes, so a newly created tenant is unreachable for up to five minutes. A deactivated tenant stays routable for up to five minutes, because nothing invalidates the cache. | `RCLimit.Modules.System.Infrastructure/TenantDirectory.cs` lines 29–30, 44, 65 |
| TS10 | Low | `DatabaseConnectionString` is defined on the tenant but not used. | `Domain/Entities/Tenant.cs` line 11 |
| TS11 | Medium | Seed `001_seed_data.sql` has a `<tenant_id>` placeholder in its default-options insert. On a fresh install that statement fails, and the rest of the file after it does not run. | `rclimit-db/seed/001_seed_data.sql` lines 153–157 |
| TS12 | Medium | Seed `001_seed_data.sql` was missing the semicolon after the rights insert. The SuperAdmin role and its grants were therefore never created on a fresh install, and the failure was silent. Fixed in the lead product types change; kept here so the reason stays visible. | `rclimit-db/seed/001_seed_data.sql` line 136 |
| TS14 | Medium | The development settings select the CrossSite profile, which takes the tenant from the `Origin` header. The Vite dev proxy sets `X-Forwarded-Host`, which only the SameSite profile reads. Through the dev server, every authenticated same-origin GET has no `Origin` header, so it fails with 403 "request host does not belong to an active tenant". Logins still work, because the browser sends `Origin` on POST. The browser test worked around it by sending the Origin header itself. Switching to SameSite in development also fails at startup, because SameSite forbids `Cors:AllowedOrigins` and requires `Auth:Edge:SharedSecret` while edge enforcement is on. Either the dev profile or the proxy must change. | `rclimit-backend-api/src/WebApi/RCLimit.WebApi/appsettings.Development.json` line 6; `rclimit-ui/vite.config.ts` line 16; `rclimit-backend-api/src/BuildingBlocks/RCLimit.BuildingBlocks.Infrastructure/Auth/RequestHostResolver.cs` lines 34–46 |
| TS13 | Low | `run_migrations.ps1` sends each migration and seed to psql with its output discarded, and it keeps going after a failure. A broken file leaves the database half set up without stopping the run. On a fresh database, migration `019` fails when the `app_user` role is missing, and nothing reports it. | `rclimit-db/run_migrations.ps1` lines 32–38, 49–52 |

## Verified as correct

- Tenant binding on requests: the token's tenant must match the host's tenant, and the edge and configuration profile are validated at startup (`RCLimit.BuildingBlocks.Infrastructure/TenantMiddleware.cs` lines 55–63; `RCLimit.BuildingBlocks.Contracts/Auth/AuthOptions.cs` lines 40–68).

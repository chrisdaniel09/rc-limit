# Gaps: Identity and access

Scope: login, refresh, logout, the session policy, users, roles, rights, authorization (`HasRight`), CSRF, rate limiting and lockout.

Paths are relative to `rclimit-backend-api/src/Modules/Identity/` unless shown otherwise. Items already listed in [../user_session_architecture_specification.md](../user_session_architecture_specification.md) are marked **(spec)**.

## Authorization

| # | Severity | Gap | Evidence |
|---|---|---|---|
| ID1 | High | Most write endpoints in other modules use `[Authorize]` only and no `HasRight`, even though their rights are seeded. Affected endpoints are listed in [cross-cutting.md](cross-cutting.md) (CC4). | `RCLimit.BuildingBlocks.Infrastructure/Authorization/HasRightHandler.cs` lines 20–27 (rights are checked only where the attribute is used) |
| ID2 | High | The super-admin bypass matches on the role name. Role names are free text, so a user who can manage roles can create a role named `SuperAdmin`, assign it to themselves, and bypass every `HasRight` check. | `RCLimit.BuildingBlocks.Infrastructure/Authorization/HasRightHandler.cs` lines 20–27; `Application/Roles/CreateRoleCommand.cs` lines 27–42; `Application/Sessions/SessionService.cs` line 166 |
| ID3 | High | The rights catalogue is global, but create and update are gated only by `rights.manage`. A tenant administrator can rename, deactivate or add rights that affect every tenant. | `rclimit-db/migrations/017_roles_and_rights.sql` line 4; `Application/Rights/UpdateRightCommand.cs` lines 25–33; `Infrastructure/Controllers/RightsController.cs` lines 26–38 |
| ID4 | High | Role and role-rights writes are not tenant-scoped. The role is loaded by id only, and only the system flag is checked. Right ids in a role update are not validated. | `Application/Roles/UpdateRoleCommand.cs` lines 25–26; `Application/Roles/SetRoleRightsCommand.cs` lines 24–25, 39–45 |
| ID5 | High | User role assignment is not tenant-scoped in either direction. Creating a user checks that role ids exist and are active, but not that they belong to the tenant. Setting a user's roles loads the user by id only, does not validate role ids, and throws an invalid-operation error (500). | `Application/Users/CreateUserCommand.cs` lines 45–49; `Application/Users/SetUserRolesCommand.cs` lines 24–28, 36–42 |
| ID6 | High | Inactive roles and inactive rights still grant access. Claim loading does not filter on `IsActive`, so deactivating a role or right has no effect on permissions. | `Application/Sessions/SessionService.cs` lines 145–161 |
| ID7 | Medium | Role and role-rights changes do not revoke sessions. Affected: setting a user's roles, setting a role's rights, and updating a role. Claims stay in the access token until it expires. | `Application/Users/SetUserRolesCommand.cs`; `Application/Roles/SetRoleRightsCommand.cs`; `Application/Roles/UpdateRoleCommand.cs` |
| ID8 | Medium | Access tokens are not checked against session state. Logout, an admin password reset and reuse detection revoke refresh tokens only. Access tokens stay valid until they expire. | `RCLimit.WebApi/Program.cs` lines 100–116; `Infrastructure/Services/JwtTokenService.cs` line 42. **(spec)** immediate revocation, around line 260 |

## Users

| # | Severity | Gap | Evidence |
|---|---|---|---|
| ID9 | Medium | No endpoint updates or deactivates a user. The active flag is never set to false in code, so no user can be deactivated through the API. | `Infrastructure/Controllers/UsersController.cs` lines 17–85 (get, lookup, set roles, create, reset password only); `Domain/Entities/User.cs` line 13 |
| ID10 | Medium | There is no self-service password reset and no change-password endpoint. The only reset is by an administrator. | `Infrastructure/Controllers/UsersController.cs` lines 84–94 |
| ID11 | Low | MFA is a flag only. The two-factor flag is stored, but nothing enforces, enrols or challenges it. | `Domain/Entities/User.cs` line 14; `Infrastructure/Persistence/Configurations/UserConfiguration.cs` line 22 |
| ID12 | Low | Password policy is length only (12 to 128 characters), with no check against breached passwords. **(spec)** breached-password screening. | `Application/Users/PasswordPolicy.cs` lines 14–21 |

## Sessions, lockout and rate limiting

| # | Severity | Gap | Evidence |
|---|---|---|---|
| ID13 | Low | Lockout works (five failures, 15 minutes, per account, cleared on success and on reset). It does not stop guessing spread across many accounts, because there is no per-IP or global throttle beyond the login rate limit. | `Domain/Entities/User.cs` lines 51–66; `Application/Commands/LoginCommandHandler.cs` lines 51–72; `RCLimit.BuildingBlocks.Contracts/Auth/AuthOptions.cs` lines 95–100 |
| ID14 | Low | Rate limiting covers login (20 per 15 minutes per IP) and refresh (120 per 15 minutes per IP). Logout, administrator password reset and user creation are not limited. | `RCLimit.WebApi/Program.cs` lines 148–167; `Infrastructure/Controllers/AuthController.cs` lines 31–32, 47–48 |
| ID15 | Medium | The CSRF guard's cross-site origin allowlist accepts any active tenant host. Its strength depends on the custom-domain process, which is itself ungated (see [tenancy-and-system.md](tenancy-and-system.md) TS3). | `RCLimit.BuildingBlocks.Infrastructure/Auth/CookieCsrfGuard.cs` lines 21–55; `Infrastructure/Controllers/AuthController.cs` lines 35, 51, 69 |
| ID16 | Low | The rights catalogue endpoint is anonymous. `GET /api/v1/rights` exposes the active rights list to callers who are not signed in. | `Infrastructure/Controllers/RightsController.cs` line 17; `Application/Rights/GetRightsQuery.cs` line 22 |

## Verified as correct

- Refresh-token rotation and reuse detection: family revocation on reuse, a concurrency token, and a 30-second grace window that returns 409 without revoking. This is by design.
- Tenant binding: the token's tenant must match the host's tenant.

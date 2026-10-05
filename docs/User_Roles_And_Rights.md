# User Roles and User Rights

## Overview
This document describes the role-based access control (RBAC) system for RCLimit. It defines how user roles are managed, what rights (permissions) exist, and how enforcement works across the backend and UI.

## Architecture

### Multi-tenancy and Scoping
- **Roles** are tenant-scoped: a role belongs to one tenant and is shared among its users.
- **Rights** are global: a right (like `loans.view`) exists once and is assigned to roles in any tenant.
- **User roles** link users to roles. A user can hold multiple roles; their effective rights are the union of all assigned role rights.

### Rights Catalogue
Rights follow a `module.action` code pattern:
- **loans**: `loans.view`, `loans.create`, `loans.edit`, `loans.delete`
- **customers**: `customers.view`, `customers.create`, `customers.edit`, `customers.delete`
- **partners**: `partners.view`, `partners.create`, `partners.edit`, `partners.delete`
- **leads**: `leads.view`, `leads.create`, `leads.edit`, `leads.delete`
- **accounting**: `accounting.view`, `accounting.create`, `accounting.edit`, `accounting.delete`
- **users**: `users.manage` (assign/remove roles)
- **roles**: `roles.manage` (create, edit, delete roles and assign rights)
- **rights**: `rights.manage` (manage the rights catalogue)

A user with `loans.view` can GET loan endpoints; a user without it receives 403 Forbidden.

### Default Roles
Every tenant gets a **SuperAdmin** role (system role, `is_system = true`):
- Cannot be deleted, renamed or have its rights removed.
- Has all rights.
- The seeded admin user (`admin@annafinance.in`) is assigned to SuperAdmin.

Custom roles (created via the Admin screen) have `is_system = false` and can be modified or deleted.

## Data Model

### Database Schema (`auth` schema)

#### `auth.roles`
| Column | Type | Notes |
|--------|------|-------|
| role_id | UUID | PK |
| tenant_id | UUID | FK users.tenant_id, scopes this role to a tenant |
| code | VARCHAR(50) | Unique per tenant, machine-friendly (e.g. `finance_manager`) |
| name | VARCHAR(100) | Display name |
| description | TEXT | Optional description |
| is_system | BOOLEAN | True for SuperAdmin, cannot be deleted or modified |
| is_active | BOOLEAN | Soft delete; inactive roles are not assigned to new users |
| created_at | TIMESTAMP | |

Unique constraint: `(tenant_id, code)`

#### `auth.rights`
| Column | Type | Notes |
|--------|------|-------|
| right_id | UUID | PK |
| code | VARCHAR(50) | Unique globally, e.g. `loans.view` |
| module | VARCHAR(50) | Group, e.g. `loans`, `users` |
| name | VARCHAR(100) | Display name |
| description | TEXT | |
| is_active | BOOLEAN | Soft delete |
| created_at | TIMESTAMP | |

Unique constraint: `code`

#### `auth.role_rights`
| Column | Type | Notes |
|--------|------|-------|
| role_id | UUID | FK roles |
| right_id | UUID | FK rights |

PK: `(role_id, right_id)`

#### `auth.user_roles`
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID | FK users |
| role_id | UUID | FK roles |

PK: `(user_id, role_id)`

### Extend `auth.users`
No changes to the users table itself. Roles are assigned through `auth.user_roles`.

## Backend Implementation

### Domain Layer (`Identity.Domain`)
Entities:
- `Role` (POCO): `RoleId`, `TenantId`, `Code`, `Name`, `Description`, `IsSystem`, `IsActive`, `CreatedAt`
- `Right` (POCO): `RightId`, `Code`, `Module`, `Name`, `Description`, `IsActive`, `CreatedAt`
- `RoleRight` (join): `RoleId`, `RightId`
- `UserRole` (join): `UserId`, `RoleId`

### Application Layer (`Identity.Application`)

#### Roles
**GetRolesQuery**: List all active roles for the current tenant, ordered by name.
- Response: `RoleDto(RoleId, Code, Name, Description, IsSystem, IsActive, RightIds)` (embedded list of right IDs)

**GetRoleQuery**: Get a single role by ID with its rights.
- Response: `RoleDto` (includes full `RightDtos`)

**CreateRoleCommand**: Create a new role.
- Request: `CreateRoleCommand(Code, Name, Description, IsSystem = false)`
- Forbid creating another SuperAdmin role per tenant.
- Response: `RoleDto`

**UpdateRoleCommand**: Rename or deactivate a role.
- Request: `UpdateRoleCommand(RoleId, Name, Description, IsActive)`
- Forbid modifying a system role.
- Response: `RoleDto`

**SetRoleRightsCommand**: Assign rights to a role.
- Request: `SetRoleRightsCommand(RoleId, RightIds[])`
- Forbid removing rights from a system role (SuperAdmin always has all).
- Response: `RoleDto`

#### Rights
**GetRightsQuery**: List all active rights, grouped by module.
- Response: `RightDto[]`

**CreateRightCommand**: Add a new right to the catalogue.
- Request: `CreateRightCommand(Code, Module, Name, Description)`
- Response: `RightDto`

**UpdateRightCommand**: Update a right's metadata or deactivate it.
- Request: `UpdateRightCommand(RightId, Name, Description, IsActive)`
- Response: `RightDto`

#### Users
Extend **GetUsersQuery**: Return user + assigned roles + effective rights.
- Response: `GetUserDto(UserId, Email, FullName, RoleDtos[], RightCodes[])`

**SetUserRolesCommand**: Assign roles to a user.
- Request: `SetUserRolesCommand(UserId, RoleIds[])`
- Response: returns updated user with roles and rights.

### Controllers

#### RolesController
- `GET /api/v1/roles` → `GetRolesQuery` (requires `roles.manage`)
- `GET /api/v1/roles/{id}` → `GetRoleQuery` (requires `roles.manage`)
- `POST /api/v1/roles` → `CreateRoleCommand` (requires `roles.manage`)
- `PUT /api/v1/roles/{id}` → `UpdateRoleCommand` (requires `roles.manage`)
- `PUT /api/v1/roles/{id}/rights` → `SetRoleRightsCommand` (requires `roles.manage`)

All return `HateoasResponse` with self, edit, delete and rights links.

#### RightsController
- `GET /api/v1/rights` → `GetRightsQuery` (no right required; UI shows all to admin)
- `POST /api/v1/rights` → `CreateRightCommand` (requires `rights.manage`)
- `PUT /api/v1/rights/{id}` → `UpdateRightCommand` (requires `rights.manage`)

#### UsersController (extend)
- `GET /api/v1/users` → `GetUsersQuery` (requires `users.manage`)
- `PUT /api/v1/users/{id}/roles` → `SetUserRolesCommand` (requires `users.manage`)

### Authorization

#### Token Claims
`JwtTokenService.GenerateAccessToken` adds:
- `role` claim (repeated for each assigned role, e.g. `role: "SuperAdmin"`, `role: "Finance Manager"`)
- `right` claim (repeated for each effective right, e.g. `right: "loans.view"`)

#### Policy-based Enforcement
In `Program.cs`:
```csharp
AddAuthorization(options =>
{
    options.AddPolicy("HasRight", policy =>
        policy.AddRequirements(new HasRightRequirement()));
});
```

A `[Authorize(Policy = "HasRight")]` attribute combined with `[HasRight("loans.view")]` on methods enforces the check. The `HasRightRequirement` handler:
- Allows SuperAdmin (has any role named "SuperAdmin").
- Otherwise checks for the `right` claim matching the attribute argument.

Alternatively, a custom attribute `[HasRight("loans.view")]` backed by a handler.

#### Endpoint Protection
Replace class-level `[Authorize]` with right-scoped attributes:
- `[HasRight("loans.view")]` on GET endpoints in `LoansController`
- `[HasRight("loans.create")]` on POST
- `[HasRight("loans.edit")]` on PUT
- Similar for Customers, Partners, Leads, Accounting, System, and Identity/Users endpoints.

Lock `/auth/register` behind `[HasRight("users.manage")]` (no longer anonymous; requires admin to create new user accounts).

Keep `/auth/login`, `/auth/me`, `/auth/logout` and `/auth/refresh` open (unauthenticated or authenticated respectively).

#### HATEOAS Links
When returning resources, only include action links (create, edit, delete) if the caller has the corresponding right. For example:
```csharp
var links = new List<HateoasLink>();
links.Add(new HateoasLink("/api/v1/loans", "self", "GET"));
if (caller has "loans.create") links.Add(new HateoasLink("/api/v1/loans", "create", "POST"));
if (caller has "loans.edit") links.Add(new HateoasLink($"/api/v1/loans/{id}", "edit", "PUT"));
if (caller has "loans.delete") links.Add(new HateoasLink($"/api/v1/loans/{id}", "delete", "DELETE"));
return Ok(new HateoasResponse<LoanDto> { Data = loan, Links = links });
```

## UI Implementation

### AuthContext Extension
Update the `User` type to include roles and rights:
```typescript
type User = {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  roles: { roleId: string; name: string }[];
  rights: string[]; // e.g. ["loans.view", "loans.create"]
};

// Helper
hasRight(code: string): boolean {
  return this.rights.includes(code) || this.rights.includes("superadmin");
}
```

Update `/auth/me` to return roles and rights. The login and refresh flows automatically refresh the user context.

### Admin Pages
Create three new pages in `pages/admin/`:

#### RolesPage.tsx
- List roles (DataTable): code, name, is_system, is_active, # of rights
- Add button (if `roles.manage`): opens modal with form fields
  - code (text, readonly if editing)
  - name (text)
  - description (textarea)
  - is_active (checkbox)
  - rights checklist (grouped by module, e.g. "Loans", "Customers") with toggles for each right
- Edit row: opens modal with same form, plus Delete button (disabled if is_system)
- Save calls `POST /api/v1/roles` (create) or `PUT /api/v1/roles/{id}` (edit)
- Rights are saved via `PUT /api/v1/roles/{id}/rights` after the role is created/updated

#### RightsPage.tsx
- List rights (DataTable): module, code, name, is_active
- Add button (if `rights.manage`): opens modal
  - code (text)
  - module (select)
  - name (text)
  - description (textarea)
- Edit row: opens same modal
- Save calls `POST /api/v1/rights` or `PUT /api/v1/rights/{id}`

#### UsersPage.tsx
- List users (DataTable): email, full name, assigned roles, # of effective rights
- Edit row: opens modal
  - email, full name (readonly)
  - role assignment (multi-select dropdown, shows all active roles per tenant)
- Save calls `PUT /api/v1/users/{id}/roles`

### Routing and Navigation
- Add routes in `App.tsx` under the protected `/` route:
  - `/admin/roles` (requires `roles.manage`)
  - `/admin/rights` (requires `rights.manage`)
  - `/admin/users` (requires `users.manage`)
- Add an "Administration" menu group in `Sidebar.tsx` with these three items, shown only if the user has at least one of the admin rights.
- Create a route guard component `ProtectedRoute` or inline checks to return 403 if the user lacks the right.

### Error Handling
Update modals to surface API errors (current implementation swallows them):
```typescript
const [error, setError] = useState<string | null>(null);
try {
  await apiPost(...)
} catch (e) {
  setError(e.message);
}
// Render error above the form
```

## Migration and Seeding

### `rclimit-db/migrations/016_roles_and_rights.sql`
Idempotent SQL (use `IF NOT EXISTS` and `CREATE IF NOT EXISTS`):
1. Create `auth.roles`, `auth.rights`, `auth.role_rights`, `auth.user_roles` tables.
2. Seed rights catalogue (all module.action pairs listed above).
3. Create a SuperAdmin role per tenant (seeded tenants).

### `rclimit-db/seed/seed_data.sql`
Add to the existing admin user insert:
- A SuperAdmin role insert (or reference the one created in 016).
- A `user_roles` row linking the admin user to SuperAdmin.

### Running
```powershell
./rclimit-db/run_migrations.ps1
./rclimit-db/seed_data.sql
```

The migration and seed are idempotent: re-running is safe.

## Testing and Verification

### API Testing
1. **Token claims**: Log in as admin, decode the JWT and verify `role: ["SuperAdmin"]` and `right: [...]` claims.
2. **Right enforcement**: Create a role with only `loans.view` right, assign it to a test user, log in as that user:
   - GET `/api/v1/loans` → 200 OK
   - POST `/api/v1/loans` → 403 Forbidden
   - PUT `/api/v1/loans/{id}` → 403 Forbidden
3. **Register protection**: POST `/api/v1/auth/register` as anonymous → 401 or 403.
4. **Stale token caveat**: Change a user's roles, wait for the current token to still be valid (access token is 15 minutes), confirm role changes take effect after refresh or login.

### UI Testing
1. Log in as admin and navigate to `/admin/roles`, `/admin/rights`, `/admin/users`.
2. Create a new role with a subset of rights.
3. Assign it to a test user.
4. Log out and log in as the test user.
5. Confirm:
   - Menu items and action buttons outside their rights are hidden.
   - Direct navigation to restricted pages (e.g. `/admin/roles`) is blocked or shows a 403 message.
   - The user can only interact with resources they have rights for.

## Token Refresh and Role Changes
The access token is valid for 15 minutes and carries role and right claims. If a user's roles are changed, the changes take effect after the access token expires and is refreshed (or the user logs in again). This is acceptable; consider documenting it in the UI.

## Future Enhancements
- Fine-grained rights: e.g. `loans.create.own` (can only create their own loans).
- Audit log: track role and right changes.
- Role templates: pre-built roles like "Loan Officer", "Accountant".
- UI permission matrix: a grid showing role × right assignments.

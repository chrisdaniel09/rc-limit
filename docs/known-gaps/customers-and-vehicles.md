# Gaps: Customers and vehicles

Scope: customer create, list, lookup and detail, customer sub-limits, the customer's leads tab, vehicles, and vehicle ownership.

Paths are relative to `rclimit-backend-api/src/Modules/Loans/` unless shown otherwise. Ownership-transfer and sub-limit reversal gaps that also affect loans are listed in [loans.md](loans.md).

## Security

| # | Severity | Gap | Evidence |
|---|---|---|---|
| CV1 | High | No `HasRight` on any customer endpoint (list, lookup, detail, create, vehicles, leads, add vehicle), though `customers.view` and `customers.create` are seeded. | `RCLimit.Modules.Loans.Infrastructure/Controllers/CustomersController.cs` lines 24–25, 49–50, 60–61, 78–79, 93–94, 109–110, 124–125; `rclimit-db/seed/001_seed_data.sql` lines 118–119 |
| CV2 | High | No `HasRight` on any vehicle endpoint, and no `vehicles.*` right is seeded. Any signed-in user can create or overwrite vehicles. | `RCLimit.Modules.Loans.Infrastructure/Controllers/VehiclesController.cs` lines 22–23, 37–38, 52–53; `rclimit-db/seed/001_seed_data.sql` lines 114–134 |
| CV3 | High | The vehicle owner is not checked for tenancy or existence, on update or when adding a vehicle to a customer. A foreign owner is accepted; a missing one becomes a foreign-key error and a 500. | `Application/Vehicles/CreateVehicleCommand.cs` line 42; `Application/Vehicles/UpdateVehicleCommand.cs` line 47; `Infrastructure/Controllers/CustomersController.cs` lines 124–135; `rclimit-db/migrations/012_vehicle_owner_customer.sql` line 3 |

## Ownership and data integrity

| # | Severity | Gap | Evidence |
|---|---|---|---|
| CV4 | High | `PUT /vehicles/{id}` writes the owner directly. It bypasses the ownership history, the transfer rules and the open-loan block. The customer page sends the owner on every edit. | `Application/Vehicles/UpdateVehicleCommand.cs` line 47; `Infrastructure/Controllers/VehiclesController.cs` line 65; `rclimit-ui/src/pages/customers/CustomerDetailPage.tsx` line 109 |
| CV5 | High | Vehicles created through `POST /vehicles` or `POST /customers/{id}/vehicles` get no ownership row. The transfer path closes only an existing open row, so the previous owner is never closed. | `Application/Vehicles/CreateVehicleCommand.cs` lines 31–47; `Infrastructure/ModuleApis/VehiclesModuleApi.cs` lines 119–129 |
| CV6 | High | The registration number is not unique, only indexed, and nothing checks for duplicates. Lookups take the first match, so the row chosen is arbitrary. | `rclimit-db/migrations/007_public_vehicles.sql` lines 6, 20; `Infrastructure/ModuleApis/VehiclesModuleApi.cs` lines 153–154; `Application/Vehicles/CreateVehicleCommand.cs` line 35 |
| CV7 | High | Registration numbers are stored as typed, but looked up with spaces and hyphens removed. Any stored value that contains either never matches, so conversion creates a duplicate vehicle. | `Infrastructure/ModuleApis/VehiclesModuleApi.cs` lines 152–154, 176–177; `Application/Vehicles/CreateVehicleCommand.cs` line 35; `Application/Vehicles/UpdateVehicleCommand.cs` line 39; `RCLimit.Modules.Leads.Application/Leads/CreateLeadCommand.cs` line 46 |
| CV8 | Medium | The ownership count is never incremented on transfer, so it goes stale. | `Infrastructure/ModuleApis/VehiclesModuleApi.cs` line 128 |
| CV9 | Medium | Customer duplicate detection is absent. Phone, PAN and GSTIN have no uniqueness and no check. | `Application/Customers/CreateCustomerCommand.cs` lines 31–60; `rclimit-db/migrations/006_public_customers.sql` lines 3–20 |
| CV10 | Low | `customer_sub_limits` has no unique constraint on `customer_id`. A customer can have several sub-limits, and the single-sub-limit joins become ambiguous. | `rclimit-db/migrations/006_public_customers.sql` lines 25–37 |
| CV11 | Medium | The sub-limit cannot be updated after creation. The ceiling, the maximum pending RC and the stop-supply flag have no write path. Stop-supply is never set true, so the UI's stop-supply state cannot occur. | `Domain/Entities/CustomerSubLimit.cs` line 11; `Application/Customers/GetCustomersQuery.cs` line 67 (read only) |
| CV12 | High | The sub-limit's lost-update race (see [loans.md](loans.md) L5) also applies here. The sub-limit configuration has no concurrency token. | `Infrastructure/Persistence/Configurations/CustomerSubLimitConfiguration.cs` lines 16–17 |

## Validation

| # | Severity | Gap | Evidence |
|---|---|---|---|
| CV13 | Medium | Customer create does not validate the legal name (may be empty), the assigned ceiling (may be zero or negative), the maximum pending RC (unbounded), or the email, PAN and GSTIN formats. | `Application/Customers/CreateCustomerCommand.cs` lines 9–18, 31–60 |
| CV14 | Medium | Customer type is not validated on create. A bad value breaks the database check and returns a 500. | `Application/Customers/CreateCustomerCommand.cs` line 39; `rclimit-db/migrations/006_public_customers.sql` line 7 |
| CV15 | Medium | Vehicle request fields are not validated: an empty registration number, a free-text RTO status (not null-checked, though the column allows null), and unbounded ownership count and year of manufacture. | `Application/Vehicles/UpdateVehicleCommand.cs` lines 8–19; `Infrastructure/Controllers/VehiclesController.cs` lines 73–83; `rclimit-db/migrations/007_public_vehicles.sql` lines 12–14 |
| CV16 | Low | Vehicle edit turns a cleared ownership count into 1. | `rclimit-ui/src/pages/customers/CustomerDetailPage.tsx` line 108 |

## Missing features

| # | Severity | Gap | Evidence |
|---|---|---|---|
| CV17 | Medium | No customer update endpoint and no edit screen. `customers.edit` is seeded but unused. | `Infrastructure/Controllers/CustomersController.cs` (absent); `rclimit-db/seed/001_seed_data.sql` |
| CV18 | Low | No standalone vehicle page or route. Vehicles are reached only through the customer tab and the loans dropdown. | `rclimit-ui/src/App.tsx` lines 48–65 |
| CV19 | Low | Create responses link to `GET /api/v1/vehicles/{id}`, which has no route. | `Infrastructure/Controllers/VehiclesController.cs` line 46; `Infrastructure/Controllers/CustomersController.cs` line 142 |

## Performance

| # | Severity | Gap | Evidence |
|---|---|---|---|
| CV20 | Medium | The customer's leads tab runs one vehicle-ownership query per lead. `customer_vehicles.source_lead_id` has a foreign key but no index. | `Application/Customers/GetCustomerLeadsQuery.cs` lines 38–49; `rclimit-db/migrations/022_lead_customers_and_customer_vehicles.sql` lines 37, 40–44 |
| CV21 | Medium | The phone-suffix lookup runs one `LIKE '%suffix'` query per suffix, with no supporting index. It runs on every conversion preview. | `Infrastructure/ModuleApis/CustomersModuleApi.cs` lines 37–47 |
| CV22 | Medium | `GET /vehicles` and `GET /vehicles/by-customer` return every row with no paging. The loans page loads the full vehicle list on every visit. | `Application/Vehicles/GetVehiclesQuery.cs` lines 21–37; `Application/Vehicles/GetVehiclesByCustomerQuery.cs` lines 21–37; `rclimit-ui/src/pages/loans/LoansPage.tsx` line 45 |
| CV23 | Low | The customer lookup returns every customer in the tenant with no cap. The code comment acknowledges this. | `Application/Customers/GetCustomerLookupQuery.cs` lines 8, 26–30; `rclimit-ui/src/pages/loans/LoansPage.tsx` line 44 |
| CV24 | Low | The vehicle lookup applies `ToUpper()` to the column, which stops the registration index from being used. | `Infrastructure/ModuleApis/VehiclesModuleApi.cs` lines 153–154 |

## Dead code and UI

| # | Severity | Gap | Evidence |
|---|---|---|---|
| CV25 | Low | `.Include(c => c.SubLimit)` is dead, because the projection already reads the sub-limit. | `Application/Customers/GetCustomerDetailQuery.cs` line 25 |
| CV26 | Low | The customer create form swallows errors (`catch {}`) and sends the trade name as `''` instead of null. | `rclimit-ui/src/pages/customers/CustomersPage.tsx` lines 85, 95–96 |
| CV27 | Low | Email, PAN and GSTIN are accepted by the API but have no field in the UI. | `rclimit-ui/src/pages/customers/CustomersPage.tsx` lines 83–89; `Application/Customers/CreateCustomerCommand.cs` lines 14–16 |

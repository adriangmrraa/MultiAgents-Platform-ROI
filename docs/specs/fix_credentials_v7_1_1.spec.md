# Specification: Consolidated Credentials & Manual Entry (v7.1.1)

## 1. Business Objective
To provide a stable and unified way to manage third-party integration credentials (TiendaNube) across different UI entry points (Stores Modal & Settings Page), ensuring multi-tenant isolation and database integrity.

## 2. Technical Requirements

### Data Schema (PostgreSQL)
- **Table**: `credentials`
- **Missing Constraint**: The `credentials` table must support a unique index on `(tenant_id, category, name)` to allow different platforms (categories) to use similar naming conventions (e.g., "access_token") without causing collision errors during `ON CONFLICT` operations.
- **Migration**: Step 36 must drop legacy unique constraints and implement category-aware indexes.

### API Layer (FastAPI)
- **Endpoint**: `/admin/tenants/{tenant_id}` (PUT)
- **Logic**: Must handle `tiendanube_access_token` and `tiendanube_store_id` by automatically synchronizing them to the `credentials` table. It must perform encryption using `utils.encrypt_password`.

### Frontend Layer (React 18)
- **Settings View**:
  - Must fetch the list of available stores (tenants).
  - Must provide a `select` dropdown to choose which store the manual credentials apply to.
  - Must use the consolidated `/admin/tenants/{tenant_id}` endpoint instead of writing directly to `/admin/credentials` twice.

## 3. Business Logic (Gherkin)

### Scenario: Manual Credential Entry in Settings
- **Given** an admin user is on the Settings page.
- **When** they expand the "Manual entry" section.
- **And** they select "Store A" from the dropdown.
- **And** they enter an Access Token and Store ID.
- **And** they click "Guardar".
- **Then** the system should send a single `PUT` request to `/admin/tenants/{store_a_id}`.
- **And** the system should verify the response and reload the page.

## 4. Acceptance Criteria
- [ ] Migration Step 36 executes successfully on startup.
- [ ] No 500 error when saving credentials via `ON CONFLICT`.
- [ ] Settings page shows a dropdown with at least one store.
- [ ] Manual entry in Settings correctly updates the selected store's credentials in the Vault.

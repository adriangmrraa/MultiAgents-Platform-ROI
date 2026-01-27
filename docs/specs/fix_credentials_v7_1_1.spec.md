# Specification: Consolidated Credentials & Vault Visibility (v7.1.1)

## 1. Business Objective
To provide a stable, unified, and visible way to manage third-party integration credentials (TiendaNube). Credentials entered via **Stores Modal** or **Settings Page** must be encrypted, stored in the Credential Vault, and appear instantly as Cards in the **Credentials** page.

## 2. Technical Requirements

### Data Schema (PostgreSQL)
- **Table**: `credentials`
- **Unique Constraint**: Standard unique index on `(tenant_id, category, name)` to support `ON CONFLICT` operations.
- **Canonical Naming**: Every TiendaNube credential synced must use strict internal names:
    - **Access Token**: `TIENDANUBE_ACCESS_TOKEN`
    - **Store ID**: `TIENDANUBE_STORE_ID`
- **User Labels**: Set `user_label` for readability in Vault cards:
    - `TIENDANUBE_ACCESS_TOKEN` -> "TiendaNube Access Token"
    - `TIENDANUBE_STORE_ID` -> "TiendaNube Store ID"

### API Layer (FastAPI)
- **Endpoint**: `/admin/tenants/{tenant_id}` (PUT)
- **Consolidation**: Both UI points MUST use this high-level endpoint.
- **Sync Routine**:
    1.  Encrypt raw token using `utils.encrypt_password`.
    2.  Upsert into `credentials` table using canonical names and user labels.
    3.  Include `credential_type_id` by looking up the correct type for `tiendanube` provider.

### Frontend Layer (React 18)
- **Settings View**:
  - Dynamic store selection via dropdown.
  - Call `PUT /admin/tenants/{id}` on save.
- **Credentials View**:
  - Prefer `user_label` for the Card title.
  - Fallback to `name` if label is empty.
  - Ensure instant visibility by reloading data after success.

## 3. Business Logic (Gherkin)

### Scenario: Instant Visibility
- **Given** an admin saves TiendaNube credentials in **Settings**.
- **When** the operation finishes successfully.
- **And** the admin navigates to the **Credentials** page.
- **Then** they should see two new cards labeled "TiendaNube Access Token" and "TiendaNube Store ID" assigned to the correct store.

## 4. Acceptance Criteria
- [x] Migration Step 36 implements robust index and cleanup.
- [ ] Backend `update_tenant` uses `TIENDANUBE_...` canonical keys.
- [ ] `Settings.tsx` implements store selection and high-level PUT call.
- [ ] `Credentials.tsx` displays `user_label` on cards.
- [ ] Credentials saved in Modal appear in Vault as Cards.
- [ ] Credentials saved in Settings appear in Vault as Cards.

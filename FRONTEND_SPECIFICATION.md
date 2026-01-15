# Nexus v5.1 Frontend Technical Specification (Sovereign UI)

> **Purpose**: This document defines the Frontend Architecture, acting as the "Client Contract" under the **Sovereign Protocol (v5.1)**.

---

## 1. Core Architecture
- **Framework**: React 18 + TypeScript + Vite.
- **Styling**: TailwindCSS + Vanilla CSS (`index.css` for Glassmorphism).
- **Security**: Mandatory `X-Admin-Token` injection via `useApi` hook.

### Key Modules (Sovereign Hub)
| Path | Component | Description |
| :--- | :--- | :--- |
| `/settings/credentials` | `Credentials.tsx` | **Sovereign Vault UI**: Manage OpenAI, Google, SMTP, and Cloud keys. |
| `/magic-onboarding` | `Onboarding.tsx` | Multi-step setup with real-time asset generation status. |
| `/chats` | `Chats.tsx` | Omnichannel HUD with human handoff controls. |
| `/platform` | `PlatformTower.tsx`| Global metrics and infrastructure health for SuperAdmin. |

---

## 2. The Sovereign Credential UI Protocol

The `Credentials.tsx` module is the user-facing interface for the Bóveda de Credenciales.

### A. Masked Value Handling
Sensitive values (API Keys) MUST NEVER be displayed in plain text after saving.
- **Protocol**: Backend returns a masked string (e.g., `sk-proj...1a2b`).
- **UI Action**: A "Eye" icon allows temporary unmasking (if permitted by role) or a "Copy" icon copies the value via a specialized unmasking endpoint.

### B. Category Selection
The frontend implements a dynamic selector for credential categories:
- `openai`: Triggers specific tooltip for usage tiers.
- `google`: Enables Google AI Vision settings in the Creative Director.
- `smtp`: Unlocks the "Agent Mode" for email tools.

---

## 3. Data Contracts (Sovereign Interfaces)

### `CredentialModel`
```typescript
interface Credential {
    id_uuid: string;
    name: string;
    category: 'openai' | 'google' | 'tiendanube' | 'smtp' | 'whatsapp_cloud';
    scope: 'global' | 'tenant';
    value_masked: string;
    tenant_id?: number;
}
```

### `TenantConfig`
```typescript
interface Tenant {
    id: number;
    store_name: string;
    onboarding_status: 'pending' | 'in_progress' | 'completed';
    handoff_enabled: boolean;
}
```

---

## 4. API Integration Strategy (`useApi.ts`)

The `useApi` hook remains the single point of contact with the backend, implementing the **Sovereign Handshake**:

1.  **Auth Injection**: Automatically reads `ADMIN_TOKEN` and adds `X-Admin-Token` header.
2.  **Error Sanitation**:
    - **401 Unauthorized**: Redirects to Login.
    - **403 Forbidden**: Shows "Sovereignty Access Denied" toast if an owner tries to access global platform keys.
    - **5xx**: Maps raw SQL errors to "Secure Cryptographic Failure" or "Credential Mismatch".

---

## 5. Developer Guide (Creating Sovereign Views)

1.  **Strict Typing**: Always define a `DTO` (Data Transfer Object) matching the Backend Specification.
2.  **Component Isolation**: Keep logic in `hooks/` and UI in `views/`.
3.  **Visual Feedback**: Use `Toaster` for all credential operations (Saving/Deleting/Updating).

---

**© 2026 Platform AI Solutions - Interface Division**

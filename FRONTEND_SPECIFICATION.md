# Nexus v5 Frontend Technical Specification (Titan Protocol)

> **Purpose**: This document defines the Frontend Architecture, acting as the "Client Contract" to be compared against the Backend Specification.

---

## 1. Core Architecture
- **Framework**: React 18 + TypeScript + Vite.
- **Styling**: TailwindCSS + Vanilla CSS (`index.css` for Glassmorphism).
- **Routing**: `react-router-dom` v6.
- **State**: React Hooks (`useState`, `useEffect`) + Custom Hooks (`useApi`).

### Key Modules (v5.1 Hub)
| Path | Component | Description |
| :--- | :--- | :--- |
| `/` | `Dashboard.tsx` | Telemetry, Health, ROI, Stats. |
| `/platform` | `PlatformTower.tsx` | Control Tower for Super Admin (Hidden for Owners). |
| `/profile` | `Profile.tsx` | Identity Management & Email Verification. |
| `/settings` | `Settings.tsx` | Integration Hub (Webhooks, Chatwoot, API Keys). |
| `/chats` | `Chats.tsx` | Message Center. |

---

## 2. Layout & Discovery Protocol

### Command Center (Top-Right)
El perfil del usuario ha sido desacoplado del Sidebar para mayor visibilidad.
- **Desktop**: Se ubica de forma fija en el Top-Right. Incluye dropdown con "Settings", "Profile" y "Logout".
- **Mobile**: Integrado en la Navbar superior para optimizar espacio.

### API Integration Strategy (`useApi.ts`)
El `useApi` hook implementa el **Protocolo "No Red Screen"**.

#### Error Sanitation
- **Errors 5xx**: Traduce errores técnicos de DB a mensajes amigables (ej: "Error en sincronización de datos").
- **Keywords Filter**: Oculta términos como `foreign key`, `unique constraint` o `database` para evitar "fugaz de información técnica" al usuario final.
- **Unauthorized (401)**: Redirige automáticamente al Login.
- **Unverified (403)**: El frontend captura el error de "Email Verification Required" para mostrar Toasts informativos en lugar de crasheos.

---

## 3. Data Contracts (Interfaces)
These interfaces MUST match the JSON returned by the Backend.

### `Chat` (in `Chats.tsx`)
```typescript
interface Chat {
    id: string;               // UUID
    name: string;             // Display Name (Fallback priority: name > display_name > phone)
    last_message: string;     // Preview text
    timestamp: string;        // ISO Date
    status: 'open' | 'human_handling' | 'human_override';
    is_locked: boolean;       // Visual indicator for Human handling
    channel: 'whatsapp' | 'instagram' | 'facebook';
    phone: string;            // external_user_id
}
```

### `Message` (in `Chats.tsx`)
```typescript
interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;          // May be null/empty if media-only
    media?: {
        type: string;         // 'image/jpeg', 'audio/ogg'
        url: string;
    };
    timestamp: string;
}
```

### `Stats` (in `Dashboard.tsx`)
```typescript
interface Stats {
    active_tenants: number;
    total_messages: number;
    processed_messages: number;
}
```

---

## 4. Resilience Features
- **Null Safety**: `Chats.tsx` protects against null `msg.content` to allow purely media messages.
- **Polling**:
  - `Chats.tsx`: Polls `/admin/chats/${id}/messages` every 3s.
  - `Dashboard.tsx`: Polls `/stats` every 30s.

---

## 5. Developer Guide: Communication Protocol (Frontend)

### How to Create & Send Requests to Backend
To communicate with the backend, **NEVER use `fetch` directly**. Always use the `useApi` hook (Gateway).

#### 1. Initialize the Gateway
Inside your React Component:
```typescript
import { useApi } from '../hooks/useApi';

const MyComponent = () => {
    const { fetchApi } = useApi(); // The Hook
    // ...
}
```

#### 2. Execute Requests (GET/POST/PUT/DELETE)
The `fetchApi` function signature handles auth injection automatically.
```typescript
// GET Request (Read)
const loadData = async () => {
    try {
        const data = await fetchApi('/admin/my-endpoint');
        console.log(data);
    } catch (e) {
        // useApi handles 401/network errors, handle logic errors here
        console.error("Logic error:", e);
    }
};

// POST Request (Create/Write)
const saveData = async () => {
    await fetchApi('/admin/my-endpoint', {
        method: 'POST',
        body: { key: 'value', complex: { nested: true } }
    });
};
```

#### 3. Handle Responses
- **Success**: `fetchApi` returns the parsed JSON object directly.
- **Failure**: If the backend returns `4xx` or `5xx`, `fetchApi` **throws an Error**. You must wrap calls in `try/catch`.
- **Loading State**: Use the `loading` state from `useApi` or your own local state to show spinners.

#### 4. Critical Rules
1.  **Prefix**: Accessing backend endpoints MUST start with `/admin/` (or `/api/admin/` if using raw URL, but `useApi` handles the base).
2.  **Types**: Always define an Interface for the response (see Section 3) to ensure type safety.

**© 2025 Platform AI Solutions - Interface Division**

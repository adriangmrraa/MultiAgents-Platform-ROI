# Nexus v4.4 Frontend Technical Specification (Protocol Omega)

> **Purpose**: This document defines the Frontend Architecture, acting as the "Client Contract" to be compared against the Backend Specification.

---

## 1. Core Architecture
- **Framework**: React 18 + TypeScript + Vite.
- **Styling**: TailwindCSS + Vanilla CSS (`index.css` for Glassmorphism).
- **Routing**: `react-router-dom` v6.
- **State**: React Hooks (`useState`, `useEffect`) + Custom Hooks (`useApi`).

### Key Modules
| Path | Component | Description |
| :--- | :--- | :--- |
| `/` | `Dashboard.tsx` | Telemetry, Health, ROI, Stats. |
| `/chats` | `Chats.tsx` | Message Center (The critical module). |
| `/stores` | `Stores.tsx` | Tenant management. |
| `/settings/ycloud` | `YCloudSettings.tsx` | Integrations. |
| `/nexus-setup` | `SetupExperience.tsx` | "Ignition" sequence (Streaming). |

---

## 2. API Integration Strategy (`useApi.ts`)
The `useApi` hook acts as the **Gateway**. It implements the "Triple Redundancy" protocol for connection resilience.

### Endpoint Discovery Logic
1.  **Localhost (Dev)**: If hostname is `localhost`, assume `http://localhost:3000` (BFF Proxy).
2.  **Legacy UI**: If hostname contains `platform-ui`, replaces with `orchestrator-service` via HTTPS.
3.  **Modern Deployment (EasyPanel)**: If hostname contains `frontend` or `easypanel`, uses **Relative Path** `/api`.
    - *Rationale*: Allows Nginx to handle reverse proxying, avoiding CORS and DNS issues ("Bunker Mode").

### Error Handling
- **Retries**: Exponential backoff (Up to 3 attempts).
- **Format Validation**: Rejects HTML responses (Common 404/500 Nginx pages) to prevent JSON parsing crashes.

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

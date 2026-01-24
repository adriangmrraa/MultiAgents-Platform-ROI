# 🔐 Bóveda de Credenciales (Settings Logic Deep Dive)

Este documento analiza la vista `Credentials.tsx`, conocida arquitectónicamente como **The Sovereign Vault Interface**.

---

## 🏗️ Filosofía de Seguridad

En Nexus v5.1, las credenciales no son parte del código (`.env` heredado). Son **Entidades de Base de Datos** gestionadas dinámicamente para lograr:
1.  **Soberanía**: Cada cliente puede traer su propia Key (`openai`, `google`).
2.  **Aislamiento**: Las Keys de un tenant nunca tocan el contexto del otro.

### Componentes Clave
1.  **Scope Selector**: Define si una llave es `Global` (Backend default) o `Tenant` (Específica).
2.  **Category Parser**: UI dinámica que cambia según si es una API Key simple o una configuración compleja (SMTP).
3.  **Integrations Dashboard (Nexus v5.99)**: Tarjetas de estado que muestran si Meta, TiendaNube y el Web Widget están operacionales.
4.  **Web Channel Configurator**: Panel dedicado para personalizar el Widget de Chat (Colores, Botón, Mensajes).

---

## 🔄 Flujo de Datos

### 1. Inventario de Llaves
-   **Endpoint**: `GET /admin/credentials`
-   **Modelo Retornado**:
    ```json
    [
      { "id": 1, "name": "GPT-4 Key", "category": "openai", "scope": "global", "value": "sk-..." }
    ]
    ```
-   **Seguridad UI**: Aunque la API devuelve el valor (para permitir edición), la lista renderiza `••••••••••••••••` estáticamente para evitar "shoulder surfing". Solo al hacer clic en **Editar** se revela el valor en el input password.

### 2. Configuración Especial: SMTP
Cuando `category === 'smtp'`, el formulario muta.
-   **Frontend Logic**: Parsea el string `value` como JSON.
    -   *Input*: `{"host": "smtp.gmail.com", "port": "587", ...}`
    -   *UI*: Muestra 4 campos separados (Host, Port, User, Pass).
-   **Backend Storage**: Al guardar, re-serializa el JSON a string y lo guarda en la columna `value` cifrada.

### 3. Asignación de Inquilinos
Si `scope === 'tenant'`:
-   Se activa un dropdown obligatorio consultando `GET /admin/tenants`.
-   **Validación**: Una credencial de tenant *debe* tener un `tenant_id` válido. Esto permite que el `NexusEngine` la encuentre durante el arranque del agente (`get_tenant_credential`).

---

## 🛡️ Cifrado (Backend Side)
Aunque esta vista maneja strings planos en los inputs:
1.  El payload viaja por **HTTPS** (obligatorio en producción).
2.  El backend (`admin_routes`) recibe el valor y usa la `INTERNAL_SECRET_KEY` (o `ENCRYPTION_KEY` maestra) para cifrarlo antes de INSERT/UPDATE en la tabla `credentials`.
3.  **Nunca** se guardan llaves en texto plano en la base de datos PostgreSQL.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

### 1. Modelos de Datos (Frontend Interfaces)
*   **Credential (`Credential`)**:
    ```typescript
    interface Credential {
      id?: number;
      name: string;
      value: string; // Encriptado en backend, pero viaja plano desde UI
      category: 'openai' | 'google' | 'smtp' | ...;
      scope: 'global' | 'tenant';
      tenant_id?: number | null;
    }
    ```

### 2. Endpoints & Payloads

#### A. Guardar Credencial
*   **Request**: `POST /api/admin/credentials`
*   **Headers**: `Authorization: Bearer <token>`
*   **Body (Caso SMTP)**:
    ```json
    {
      "name": "Gmail Corporate",
      "category": "smtp",
      "value": "{\"host\":\"smtp.gmail.com\",\"port\":\"587\",\"user\":\"...\",\"pass\":\"...\"}",
      "scope": "tenant",
      "tenant_id": 5
    }
    ```
*   **Aviso**: Si `tenant_id` es null y `scope` es tenant, el backend lanzará `400 Bad Request`.

#### B. Listar e Hidratar
*   **Request**: `GET /api/admin/credentials`
*   **Response**: Devuelve todas las credenciales visibles para el usuario.
*   **Seguridad**: El campo `value` NO debería viajar en este GET por seguridad máxima, pero actualmente viaja para permitir la edición.
    *   *Mejora V6*: Devolver `value: "*****"` y crear un endpoint separado `/credentials/{id}/reveal` con auditoría para ver el valor real.

### 3. Problemas Comunes
*   **Error de Encriptación**: "Invalid padding" o "Decryption failed" en el backend.
    *   **Causa**: La `INTERNAL_SECRET_KEY` o `ENCRYPTION_KEY` cambió entre el momento que se guardó la credencial y ahora. Si cambias las llaves maestras en `.env`, todas las credenciales viejas se vuelven basura ilegible.
*   **SMTP Fallando**:
    *   **Causa**: El JSON stringificado en `value` está mal formado.
    *   **Solución**: Borrar la credencial corrupta desde la UI y crearla de nuevo.


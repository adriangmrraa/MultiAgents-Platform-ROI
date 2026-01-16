# 🧠 Nexus v5.1: Technical Deep Dive

> **Arquitectura de Sistemas, Seguridad y Modelos de Datos.**
> *Documento para Desarrolladores y Auditores.*

---

## 1. Arquitectura Soberana (Sovereign Vault)

### Problema
La arquitectura v1 dependía de variables de entorno estáticas (`.env`), lo que hacía imposible escalar a múltiples clientes con diferentes credenciales de IA (OpenAI/Gemini) en el mismo servidor.

### Solución: La Bóveda Dinámica
Implementamos un sistema de inyección de dependencias en tiempo de ejecución.

*   **Almacenamiento:** Tabla `credentials` en PostgreSQL.
*   **Encriptación:** Fernet (Simétrica AES-256). La llave maestra `ENCRYPTION_KEY` nunca sale del servidor.
*   **Recuperación:** 
    ```python
    # Pseudo-código del inyector
    async def get_tenant_llm_key(tenant_id):
        encrypted_key = db.fetch("SELECT value FROM credentials WHERE tenant_id = $1 AND name = 'openai_api_key'")
        return decrypt(encrypted_key, MASTER_KEY)
    ```

### Blindaje de Base de Datos (Database Armour)
Para evitar colisiones de nombres ("Namespace Pollution"), aplicamos una restricción compuesta:

```sql
UNIQUE(name, tenant_id);
```
Esto permite que el Tenant A y el Tenant B tengan ambos una credencial llamada `google_api_key`, pero sean filas totalmente distintas y aisladas.

---

## 2. Inteligencia Multi-Cloud (Neural Routing)

Nexus v5.1 no está atado a un solo proveedor de IA.

s*   **OpenAI (GPT-4o):** Usado para razonamiento complejo ("Ventas Expert", "Soporte").
*   **Google (Gemini 2.5 / Imagen 3):** Usado para tareas multimodales y creativas de alto rendimiento ("Director Creativo").
*   **Inyección por Tenant:** El `NexusEngine` consulta la configuración del tenant antes de instanciar el cliente de IA. Si el cliente tiene su propia llave de Google, el sistema la usa; si no, repliega al *System Fallback* (si está configurado) o lanza error de cuota.

---

## 3. Protocolo Meta Uplink (Sync Interno)

La integración con Meta (Facebook/WhatsApp) sigue un patrón de "Diplomático y Cerebro".

1.  **Meta Service (Diplomático):**
    *   Maneja el OAuth Popup y el `code_exchange`.
    *   **NO guarda nada.** Solo "traduce" la respuesta de Meta.
    *   Sanitiza la respuesta al frontend (quita tokens).
    *   Envía los datos crudos (tokens + activos) por un canal seguro interno al Orchestrator.

2.  **Orchestrator (Cerebro):**
    *   Endpoint: `POST /admin/credentials/internal-sync`.
    *   Protegido por `INTERNAL_SECRET_KEY`.
    *   Persiste los tokens en la Bóveda Soberana.
    *   Deja los activos en estado `pending` en la tabla `business_assets`.

3.  **Wizard (Frontend):**
    *   Permite al usuario seleccionar qué activos activar.
    *   Llama a `update-channels` para cambiar el estado de `pending` a `active`.

### Mecanismo de Escalada de Token (Sovereign 60-Day)
Para evitar desconexiones, el `meta_service` realiza un doble canje (Double Exchange Flow):
1.  **Code -> Short Token**: Válido por 1 hora. Vinculado a la sesión web.
2.  **Short Token -> Long Token**: Llamada inmediata a `oauth/access_token` con `grant_type=fb_exchange_token`.
3.  **Resultado**: Un token de sistema válido por **60 días** que **no caduca** al cerrar el navegador.

### Seguridad Multi-Inquilino (Strict Tenant Binding)
*   **Usuarios Normales**: El backend **fuerza** `tenant_id = current_user.tenant_id`. Cualquier intento de inyección de ID externo es ignorado y logueado como alerta de seguridad.
*   **Super Admin**: Tiene permiso explícito para pasar un `tenant_id` arbitrario en el body, permitiendo la configuración centralizada de múltiples tiendas.

---

## 4. Auto-Sedimentación (Migration Bridge)

Para facilitar la actualización desde v1/v4 sin configuración manual:

1.  **Bootloader Check:** Al iniciar `main.py`, se verifica la tabla `tenants`.
2.  **Seed Detection:** Si no hay credenciales en la DB pero existen en `os.environ`.
3.  **Migration:** El sistema copia las variables de entorno a la tabla `credentials` del primer tenant detectado.
4.  **Log:** Se emite una alerta de éxito para que el admin sepa que puede limpiar su `.env`.

---

---

## 5. Referencias Atómicas (Deep Dives)

Para detalles de implementación línea-por-línea, consulta los siguientes documentos:
*   [Agents Logic](AGENTS_LOGIC_DEEP_DIVE.md)
*   [Chats Logic](CHATS_LOGIC_DEEP_DIVE.md)
*   [Magic/Onboarding Logic](MAGIC_LOGIC_DEEP_DIVE.md)
*   [Integrations/Meta Logic](INTEGRATIONS_LOGIC_DEEP_DIVE.md)
*   [RAG/Knowledge Logic](RAG_LOGIC_DEEP_DIVE.md)

---

**© 2026 Platform AI Solutions - Engineering**

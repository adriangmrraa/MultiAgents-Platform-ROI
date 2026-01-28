# 🔗 Integraciones: Meta Diplomat (Logic Deep Dive)

Este documento explica la lógica de `MetaSettings.tsx` y el asistente de integración `MetaOnboardingWizard`, componentes críticos para la omnicanalidad.

---

## 🏗️ El Protocolo "Meta Diplomat"

La integración con Meta no es un simple OAuth. Es un proceso de **Vinculación de Activos de Negocio** (Pages, WABA, Instagram Accounts) a un Inquilino de Nexus.

### Componentes Clave
1.  **SDK Loader (`useFacebookSdk`)**: Hook que inyecta asíncronamente el script de `connect.facebook.net`.
2.  **Login Flow (Popup)**: Manejo de la ventana emergente de permisos.
3.  **Discovery Wizard**: Interfaz post-login que permite elegir qué activos conectar.

## 1A. Universal Delivery Relay (v6.2.9 Architecture)

Nexus v6.2.9 evoluciona la entrega de mensajes. Ya no se trata de ruteo disperso; ahora toda la comunicación de salida fluye a través de un **Relay Gateway Centralizada** (`whatsapp_service`).

### Estrategia de Entrega Única
1.  **Orquestador as Client**: El orquestador decide *qué* decir y delega el *cómo* al Relay.
2.  **Relay Gateway Intelligence**:
    *   **Spacing (4s)**: El relay aplica un retraso humano entre burbujas para evitar bans de Meta.
    *   **Dynamic Auth**: Consulta las credenciales des-encriptadas al Orquestador según el `tenant_id`.
    *   **Protocol Neutral**: Maneja Graph API (FB/IG/WA), YCloud y Chatwoot de forma transparente.

### Tabla de Decisiones (v6.2.9)
| Canal | Proveedor | Gateway de Entrega | Lógica Especial |
| :--- | :--- | :--- | :--- |
| **WhatsApp** | Meta Direct | `whatsapp_service` (Relay) | Graph API + Multi-Tenant IDs |
| **WhatsApp** | YCloud | `whatsapp_service` (Relay) | YCloud Client + Spacing |
| **FB / IG** | Meta Direct | `whatsapp_service` (Relay) | Graph API + Spacing 4s |
| **Cualquiera** | Chatwoot | `whatsapp_service` (Relay) | Chatwoot API Relay |

> [!IMPORTANT]
> A partir de v6.2.9, **`whatsapp_service` NO es solo para WhatsApp**. Es el **Universal Relay Gateway**. La "Inteligencia de Envío" (spacing, re-intentos por canal) reside en este gateway, permitiendo que el Orquestador se enfoque 100% en el razonamiento de la IA.

---

## 🔗 1B. Multi-Tenant Channel Routing (v7.5 Architecture)

Nexus v7.5 introduce la capacidad de desacoplar los canales de los tenants fijos. Ahora, un solo número de teléfono o ID de inbox puede ser re-asignado dinámicamente entre tiendas.

### El Corazón del Ruteo: `channel_bindings`
La tabla `channel_bindings` reemplaza la dependencia del `bot_phone_number` en la tabla `tenants`. Cada entrada en esta tabla mapea un `channel_id` a un `tenant_id`.

**Beneficios de esta arquitectura:**
- **Asociación Dinámica**: Un administrador puede mover un canal de YCloud de la tienda "A" a la tienda "B" desde la UI sin tocar código.
- **Identidad de Dueño (Owner-Centric)**: Los usuarios que poseen múltiples tiendas (ej. Adrian) pueden ver y gestionar todos sus canales en una lista unificada basada en su email.
- **Persistencia Anti-Zombie**: Se ha eliminado la migración automática heredada que recreaba canales borrados. Ahora, el sistema solo autogestiona canales si la tabla de vinculaciones está vacía.

### Flujo de Resolución Híbrido v7.5.2
1.  **Prioridad 1 (Binding)**: El sistema busca el `channel_id` en `channel_bindings`. Si el proveedor es 'chatwoot', requiere además coincidencia con el `external_account_id` enviado en el webhook.
2.  **Prioridad 2 (Legacy)**: Si no hay binding, se limpia el ID (solo dígitos) y se busca en `tenants.bot_phone_number`.
3.  **Contexto**: Una vez identificado el `tenant_id`, se carga la personalidad del agente y las reglas específicas de la tienda.

---

## 🔄 Flujo de Conexión (Paso a Paso)

### 1. Inicialización (Frontend)
El componente carga el SDK usando el `VITE_META_CONFIG_ID`.
-   Esto pre-configura los permisos solicitados: `pages_show_list`, `instagram_basic`, `whatsapp_business_messaging`.

### 2. Disparo del Popup
Al hacer clic en "Conectar con Meta":
-   `FB.login()` abre la ventana segura de Facebook.
-   El usuario selecciona sus negocios y otorga permisos.
-   **Retorno**: Meta devuelve un `code` (OAuth Authorization Code) al callback JS.

### 3. Intercambio de Fichas (Handshake Backend)
El frontend envía el `code` a `/admin/meta/connect`.
-   **Backend**: Intercambia el código efímero por un **Long-Lived User Token** (60 días).
-   **Descubrimiento**: El backend usa ese token para auto-descubrir:
    -   Páginas de Facebook administradas.
    -   Cuentas de Instagram Business vinculadas.
    -   Cuentas de WhatsApp Business (WABA).
-   **Respuesta**: Devuelve una lista JSON de `assets` encontrados para que el usuario elija.

### 4. El Hechizo de Selección (Wizard)
Si la conexión es exitosa, se abre el `MetaOnboardingWizard`.
-   El usuario marca checkboxes: "¿Qué página usar para ESTA tienda?".
-   **Confirmación**: Al guardar, el backend persiste solo los IDs seleccionados en la tabla `tenants` (columnas `meta_page_id`, `whatsapp_business_account_id`, etc.) y guarda el Token Maestro en la Bóveda de Credenciales (`credentials` table).

---

## 🛡️ Seguridad y Redirección

El flujo de Meta es extremadamente estricto con las URLs.
-   **Redirect URI**: Debe coincidir carácter por carácter con lo configurado en la Meta App Dashboard. `MetaSettings.tsx` construye dinámicamente `window.location.origin + '/'` para cumplir esto.

## ⚡ Estado "Connected"

Una vez conectado, la UI muestra una grilla con los iconos de FB/IG/WA.
-   **Check Verde**: Activo y token válido probados.
-   **Alerta Amarilla**: Permiso faltante (ej: usuario conectó FB pero olvidó dar permiso a WA).
# 🌐 Integraciones: Web Widget (Zero-Config Channel)

Nexus v6.0 introduce el **Web Widget**, un canal directo sin dependencias de terceros (como Meta o TiendaNube) que se instala en cualquier sitio web.

### 🏗️ Lógica de Activación y Descubrimiento (v6.0)
A diferencia de versiones anteriores donde la lista de canales era estática, el nuevo **ChannelModal** implementa un descubrimiento dinámico basado en las capacidades del tenant.

1.  **Capability Scan**: Al abrir el selector de canales del agente, el frontend escanea las credenciales activas del inquilino:
    -   `CHATWOOT_API_TOKEN` -> Habilita canal Chatwoot.
    -   `WHATSAPP_PHONE_NUMBER_ID` -> Habilita WhatsApp Meta.
    -   `YCLOUD_API_KEY` -> Habilita WhatsApp YCloud.
2.  **Filtrado de UI**: El sistema solo muestra los canales que tienen una "Vía de Comunicación" configurada, evitando errores de envío en tiempo de ejecución.
3.  **Configuración Visual**: En `Settings > Canal Web`, el usuario define el "Look & Feel" (colores, mensajes) para el widget que siempre está disponible.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)
/* ... same as before ... */

Esta es la sección más frágil del sistema debido a la dependencia externa (Meta Graph API).

### 1. Variables de Entorno y SDK
*   `VITE_META_CONFIG_ID`: ID de configuración en Meta Developers. Si es incorrecto, el popup mostrará "App not configured".
*   `window.FB`: Objeto global inyectado. Si es `undefined`, el ad-blocker del usuario bloqueó `connect.facebook.net`.

### 2. Endpoints & Flujo de Tokens

#### A. Handshake (Connect)
*   **Request**: `POST /api/admin/meta/connect`
*   **Body**:
    ```json
    {
      "code": "AQC...", // Auth Code efímero
      "redirect_uri": "https://mi-dominio.com/", // EXACT MATCH requerido
      "tenant_id": 5 // Opcional (Solo SuperAdmin)
    }
    ```
*   **Respuesta Exitosa**:
    ```json
    {
      "status": "success",
      "assets": {
        "pages": [...],
        "instagram": [...],
        "whatsapp": [...]
      },
      "connected": { "facebook": true, "whatsapp": false }
    }
    ```
*   **Error 400 "Invalid Redirect URI"**: Ocurre si `window.location.origin + '/'` no está en la lista de "Valid OAuth Redirect URIs" en el Panel de Meta.

#### B. Errores de Graph API (Backend)
El backend (`meta_service`) puede lanzar excepciones específicas que el frontend debe mostrar.
*   `OAuthException`: Token vencido o revocado por el usuario.
*   `Permissions Missing`: El usuario desmarcó un permiso crítico en el popup.

#### C. WABA Integration (Direct Cloud API)
El endpoint `POST /whatsapp/send` en `meta_service` maneja el envío directo a WhatsApp Cloud API.
*   **Payload Diferente**: Usa `messaging_product: "whatsapp"` y requiere `phone_number_id`.
*   **Token**: Puede usar el mismo System User Token que las Pages, o uno específico de WABA.

### 3. Debugging de UI (Wizard)
*   **Wizard no abre**: Verifica si `res.status === 'success'`. Si el backend falló al obtener assets (ej: timeout de Meta), no enviará assets y el wizard no tiene qué mostrar.
*   **Lista vacía en Wizard**: El usuario se logueó pero su cuenta de Facebook no tiene Páginas o Cuentas de Negocio creadas.

---

# 🛍️ Integraciones: Tienda Nube (Protocolo OAuth Partners)

Esta integración permite la sincronización de catálogo y órdenes. Funciona bajo el modelo **Redirect OAuth** con Popups.

## 🏗️ Arquitectura de Conexión

### Componentes Clave
1.  **`tiendanube_service`**: Actúa como un *Auth Broker*. Maneja el intercambio de credenciales y las guarda en la bóveda del Orchestrator.
2.  **Redirect URI Config**: Configuración estricta en el panel de Partners de Tienda Nube.
3.  **Vault Injection**: El servicio de Tienda Nube inyecta las credenciales (`TIENDANUBE_ACCESS_TOKEN`, `TIENDANUBE_USER_ID`) directamente en la base de datos del Orchestrator mediante una llamada interna segura (`X-Internal-Secret`).

## 🔄 Flujo de Conexión

1.  **Inicio (Frontend)**:
    -   El usuario hace clic en "Conectar".
    -   Se abre un popup hacia `/auth/login?tenant_id=X`.
    -   El backend (`tiendanube_service`) redirige a Tienda Nube con `client_id` y `state` encriptado.

2.  **Autorización (Tienda Nube)**:
    -   El usuario instala la App en su tienda.
    -   Tienda Nube redirige al `redirect_uri` (`/auth/callback`).

3.  **Captura y Almacenamiento**:
    -   El backend recibe el `code`.
    -   Intercambia el `code` por `access_token` y `user_id`.
    -   **CRÍTICO**: Inyecta estos valores en la tabla `credentials` del Orchestrator.

4.  **Cierre**:
    -   El backend devuelve un HTML con un script `window.opener.postMessage(...)` para notificar al Frontend y cerrar el popup.

## 🔌 Estado "Connected" (Lógica Estricta)

Para evitar falsos positivos, el sistema solo marca la conexión como **"CONECTADO" (`true`)** si existen **AMBOS** valores en la base de datos:
1.  `TIENDANUBE_ACCESS_TOKEN`
2.  `TIENDANUBE_USER_ID` (Store ID)

Si falta el ID, se considera "PENDIENTE" aunque exista el token (posible residuo de configuración manual parcial).

## 🛠️ Troubleshooting (Errores Comunes)

### 1. "No encontramos lo que estás buscando" (404 en Tienda Nube)
Este error ocurre **antes** de llegar a nuestro código, directamente en los servidores de Tienda Nube.

*   **Causa A (Redirect URI)**: La URL configurada en el Panel de Partners TU y la enviada en el parámetro `redirect_uri` no coinciden *exactamente*.
    *   *Correcto*: `https://midominio.com/auth/callback`
    *   *Incorrecto*: `https://midominio.com/tiendanube/auth/callback` (Ruta extra no registrada)
*   **Causa B (Client ID)**: El `client_id` usado no existe en la región (Tienda Nube vs Nuvemshop) o está mal copiado.
*   **Causa C (App Draft)**: Si la App está en modo "Borrador", **SOLO** se puede instalar en "Tiendas de Prueba" creadas desde el mismo panel de partners. Intentar instalarla en una tienda real o demo externa fallará.

### 2. "Unhealthy" (Servicio Amarillo en EasyPanel)
*   Verificar que el `Dockerfile` use `CMD ["uvicorn", ...]` y no `python main.py`, ya que este último sale inmediatamente si no tiene un bloque de ejecución.
*   El puerto debe ser `8003`.

### 3. Conexión Exitosa pero "Pendiente" en UI
*   Hubo un error al guardar el `TIENDANUBE_USER_ID`.
*   Verificar los logs del `tiendanube_service` buscando "credential_synced".

---

# 🆕 Mejoras de Arquitectura v6.2 (Sovereign Identity Protocol)

## 1. Protocolo de Identidad Blindada para Chatwoot

### Problema Resuelto: "Conversación Conmigo Mismo"
En versiones anteriores, cuando un agente humano respondía manualmente desde Chatwoot (Instagram/Facebook), el sistema creaba una conversación duplicada con el nombre del agente en lugar del cliente.

### Solución v6.2: TRUE Contact Resolution
El webhook unificado (`/admin/chatwoot/webhook`) ahora implementa:
- **Customer Map Extraction**: Extrae la información del cliente real desde `conversation.meta.sender` en lugar del `sender` del mensaje.
- **Identity Persistence**: Garantiza que el nombre y avatar del cliente en el Dashboard nunca sean sobrescritos por los datos del agente.
- **Metadata Enrichment**: Almacena `customer_name` y `customer_avatar` en el campo `meta` de `chat_conversations`.

## 2. Atomic Buffer Consumption (Debounce Inteligente)

Para canales sociales donde los usuarios envían múltiples mensajes cortos en ráfaga:
- **Buffer Redis**: Acumula mensajes durante 16 segundos antes de procesarlos.
- **Lock Mechanism**: Previene procesamiento concurrente con un lock de 60 segundos.
- **Beneficios**:
  - Reduce costos de tokens al consolidar contexto.
  - Mejora coherencia de respuestas de la IA.
  - Evita respuestas fragmentadas.

## 3. API Interna de Credenciales (X-Internal-Token)

### Endpoint: `/admin/internal/credentials/{name}`
Permite a microservicios (`whatsapp_service`, `tiendanube_service`, `meta_service`) obtener credenciales desencriptadas de forma segura.

**Seguridad**:
- Header requerido: `X-Internal-Token`
- Soporta scope global y por tenant
- Elimina la necesidad de variables de entorno redundantes

**Ejemplo de uso**:
```python
headers = {"X-Internal-Token": INTERNAL_SECRET_KEY}
response = await httpx.get(
    f"{ORCHESTRATOR_URL}/admin/internal/credentials/YCLOUD_API_KEY",
    headers=headers,
    params={"tenant_id": 123}
)
api_key = response.json()["value"]
```

## 4. Webhook Unificado de Chatwoot

Toda la lógica de recepción de mensajes de Chatwoot (Instagram, Facebook, WebChat) se ha centralizado en el Orchestrator:
- **Endpoint**: `/admin/chatwoot/webhook?access_token=SECURE_TOKEN`
- **Procesamiento**:
  - Detección automática de Ecos (respuestas humanas)
  - Activación de Human Handoff Lock (24h)
  - Trigger automático del motor de IA
  - Sincronización en tiempo real con el Dashboard


## 5. Centralización de Emails de Derivación (v6.2)

### Problema Resuelto: Complejidad SMTP del Tenant
En versiones anteriores, cuando un agente derivaba una conversación a un humano (`derivhumano` tool), el sistema requería que cada tenant configurara sus propias credenciales SMTP:
- `smtp_host`
- `smtp_port`
- `smtp_username`
- `smtp_password_encrypted`
- `smtp_security`

Esto generaba:
- **Barrera de entrada técnica**: Usuarios sin conocimientos técnicos no podían activar derivaciones
- **Costos adicionales**: Cada tenant necesitaba su propio servidor SMTP
- **Complejidad de soporte**: Debugging de problemas SMTP específicos por tenant

### Solución v6.2: SMTP Global de Plataforma

Todos los emails de derivación ahora se envían usando las credenciales SMTP globales de la plataforma (mismas que los emails de verificación).

**Cambios implementados**:

1. **Función `derivhumano()` actualizada** (`orchestrator_service/main.py`):
   ```python
   # Antes (v6.1)
   smtp_config = await get_tenant_credential(tenant_id, "smtp", "%host%")
   # Configuración compleja de SMTP por tenant...
   
   # Ahora (v6.2)
   from app.core.email import EmailService
   dynamic_conf = await EmailService.get_connection_config(
       tenant_id=tid, 
       mode="system"  # Usa SMTP global
   )
   ```

2. **Simplificación de configuración**:
   - **Antes**: 5 campos técnicos SMTP + 1 email destino
   - **Ahora**: 1 campo simple (`destination_email`)

3. **Migración de esquema** (`scripts/migration_cleanup_handoff_smtp.sql`):
   ```sql
   ALTER TABLE tenant_human_handoff_config
   DROP COLUMN IF EXISTS smtp_host,
   DROP COLUMN IF EXISTS smtp_port,
   DROP COLUMN IF EXISTS smtp_security,
   DROP COLUMN IF EXISTS smtp_username,
   DROP COLUMN IF EXISTS smtp_password_encrypted;
   ```

**Beneficios**:
- 🎯 **UX mejorada**: Configuración reducida de 6 campos a 1
- 🔒 **Seguridad**: Credenciales SMTP centralizadas y controladas
- 💰 **Costo**: Un solo servidor SMTP para toda la plataforma
- ⚡ **Mantenimiento**: Cambios de SMTP se hacen en un solo lugar (env vars)
- 🏢 **Branding**: Todos los emails salen del dominio corporativo de la plataforma

**Email HTML profesional**:
Los emails de derivación ahora usan un template HTML moderno con:
- Gradientes y diseño limpio
- Información estructurada del cliente y motivo de derivación
- Link directo a WhatsApp del cliente
- Footer con branding de Nexus Platform

**Configuración requerida** (solo una vez en variables de entorno):
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=noreply@platform.com
SMTP_PASS=app_password_here
```

---


---

# 🧠 Protocolo Sovereign Assist Score (v7.6)

Nexus v7.6 introduce un mecanismo de **Auto-Auditoría Soberana** para cuantificar el valor real que la IA aporta a cada tienda.

## 🏗️ Lógica de Auto-Auditoría
A diferencia de sistemas de analytics pasivos, Nexus utiliza un modelo de auditoría activa inyectado en el ciclo de pensamiento del agente.

1.  **Frecuencia (Tick de 3 Turnos)**: El agente tiene instrucciones tácticas para evaluar su propio desempeño cada 3 mensajes recibidos del usuario.
2.  **Clasificación de Impacto**:
    *   **Sales Score**: Ayuda directa en la conversión (stock, precios, variantes, links de pago).
    - **Support Score**: Resolución de dudas técnicas, envíos o políticas sin intervención humana.
3.  **Herramienta `report_assistance`**: El agente llama a esta tool de forma silenciosa. El Orquestador persiste el score y el **razonamiento (reasoning)** en la tabla `chat_conversations`.

## 📈 Cálculo de ROI Estratégico
El sistema traduce estos puntos en métricas de negocio tangibles:

*   **Ahorro Operativo**: `Puntos de Soporte * $1000 ARS`. Representa el costo de oportunidad del tiempo de un agente humano.
*   **Tracción Comercial**: Puntos de Ventas acumulados que indican la efectividad de la IA como cerradora.

> [!TIP]
> Puedes ver el log de razonamiento de cada punto en la vista **ROI Deep Dive**, permitiendo auditar por qué la IA se asignó un puntaje determinado.

---

**© 2026 Platform AI Solutions - Sovereign Integration Division**


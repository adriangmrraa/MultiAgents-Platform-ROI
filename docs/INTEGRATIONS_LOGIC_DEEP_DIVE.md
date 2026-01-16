# 🔗 Integraciones: Meta Diplomat (Logic Deep Dive)

Este documento explica la lógica de `MetaSettings.tsx` y el asistente de integración `MetaOnboardingWizard`, componentes críticos para la omnicanalidad.

---

## 🏗️ El Protocolo "Meta Diplomat"

La integración con Meta no es un simple OAuth. Es un proceso de **Vinculación de Activos de Negocio** (Pages, WABA, Instagram Accounts) a un Inquilino de Nexus.

### Componentes Clave
1.  **SDK Loader (`useFacebookSdk`)**: Hook que inyecta asíncronamente el script de `connect.facebook.net`.
2.  **Login Flow (Popup)**: Manejo de la ventana emergente de permisos.
3.  **Discovery Wizard**: Interfaz post-login que permite elegir qué activos conectar.

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

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

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

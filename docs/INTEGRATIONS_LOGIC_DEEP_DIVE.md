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


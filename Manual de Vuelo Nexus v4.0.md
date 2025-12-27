# ✈️ Manual de Vuelo Nexus v4.0 (Protocolo Omega)

Este es el manual operativo oficial para la gestión del ecosistema Nexus v4.0.

---

## 1. Onboarding de Nuevas Tiendas

Para activar un nuevo cliente/tienda en la plataforma:

1. **Recolección de Datos**:
   - ID de Tienda Nube.
   - Access Token de Tienda Nube.
   - Número de WhatsApp (con código de país, ej: `54911...`).

2. **Uso del Magic Onboarding**:
   - Ve a la sección **Magic Onboarding** en el Smart Sidebar.
   - Ingresa los datos solicitados.
   - El sistema activará el **Nexus Engine** para generar automáticamente:
     - Branding y paleta de colores.
     - Scripts de atención al cliente basados en el catálogo.
     - Estrategia de ROI inicial.

3. **Verificación**:
   - Revisa el **Neural Thinking Log** en el Dashboard para asegurar que el agente ha procesado la información correctamente.

---

## 2. Configuración de Seguridad en Easypanel

Si realizas una nueva instalación o el sitio muestra "Invalid Admin Token":

1. Ve a la pestaña **General** -> **Source** -> **Advanced** del servicio `frontend-react`.
2. En **Build Arguments**, agrega:
   - `VITE_ADMIN_TOKEN`: Tu secreto maestro.
   - `VITE_API_BASE_URL`: URL del Orquestador (ej: `https://multiagents-orchestrator.yn8wow.easypanel.host`).
3. Ve a la pestaña **Deploys** y haz clic en **Deploy**.

---

## 3. Resolución de Problemas (Troubleshooting)

| Síntoma | Solución |
| :--- | :--- |
| **Error 401 (Unauthorized)** | Los tokens en Orchestrator y Frontend no coinciden. Revisa los Build Arguments. |
| **Página en Blanco/Carga infinita** | El BFF Service podría estar caído. Verifica su estado en Mission Control. |
| **Agente no responde en WhatsApp** | Revisa los logs en `whatsapp_service` y confirma que el Webhook en YCloud apunte al orquestador. |

---

## 4. Mantenimiento del Sistema

- **Actualizaciones**: Solo haz `git push origin master`. Easypanel detectará los cambios y reconstruirá los servicios.
- **Base de Datos**: No requiere mantenimiento manual. El sistema auto-repara su esquema al iniciar.

---

**© 2025 Platform AI Solutions - Flight Operations**

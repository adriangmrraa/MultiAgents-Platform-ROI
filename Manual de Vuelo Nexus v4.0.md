# ✈️ Manual de Vuelo Nexus v4.4 (Protocolo Omega)

Este es el manual operativo oficial para la gestión del ecosistema Nexus v4.4.

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
   - El sistema activará el **Nexus Engine** para generar automáticamente todo el ecosistema.

---

## 2. Gestión de Chats y Mensajería

Con la implementación de la **Omnicanalidad Nexus v4.4**:

- **Estructura de ID**: Se utilizan UUIDs estrictos para todas las conversaciones.
- **Canales**: Soporte nativo para WhatsApp, Instagram y Facebook.
- **Identity Link**: Todas las conversaciones están vinculadas a un `customer_id` único para trazabilidad 360°.

---

## 3. Resolución de Problemas (Troubleshooting)

| Síntoma | Solución |
| :--- | :--- |
| **Error 401 (Unauthorized)** | Los tokens en Orchestrator y Frontend no coinciden. Revisa los Build Arguments. |
| **Chats Vacíos / ID undefined** | Asegúrate de que el backend haya aplicado el esquema de `meta` y `channel_source` (se auto-repara al iniciar). |
| **Página en Blanco** | El BFF Service podría estar caído. Verifica su estado en Mission Control. |

---

## 4. Mantenimiento Automático (Self-Healing)

Nexus v4.4 incluye el **Protocolo de Auto-Reparación**:
- Si una consulta falla por una columna o tabla faltante, el sistema inyecta automáticamente la infraestructura necesaria basándose en los modelos de Python (SSOT).
- **Actualizaciones**: Solo haz `git push`. El sistema se encarga del resto.

---

**© 2025 Platform AI Solutions - Flight Operations**

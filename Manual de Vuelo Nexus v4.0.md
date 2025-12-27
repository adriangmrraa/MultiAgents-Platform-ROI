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

## 2. Gestión de Chats (UX Avanzada)

Nexus v4.4 introduce mejoras críticas en la interacción:

### A. Smart Scroll (Desplazamiento Inteligente)
- **Carga de Chat**: Al seleccionar una conversación, el sistema te lleva automáticamente al final.
- **Navegación Histórica**: Si subes para leer mensajes antiguos, el sistema **no te forzará a bajar** cuando lleguen nuevos mensajes (polling).
- **Auto-Update**: Solo volverás al fondo automáticamente si ya te encuentras al final de la charla cuando llega un mensaje nuevo.

### B. Intervención Humana (Human Override)
- **Botón "Agente Activo"**: Al desactivarlo, bloqueas la IA para ese chat específico.
- **Persistencia Total**: El estado de bloqueo se guarda en la base de datos y se mantiene incluso tras refrescar la página (`F5`).
- **Trazabilidad**: Los mensajes enviados manualmente quedan registrados con su `channel_source` (WA, IG, FB) para auditoría.

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

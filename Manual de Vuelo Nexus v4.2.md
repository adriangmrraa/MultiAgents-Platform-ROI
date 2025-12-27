# ✈️ Manual de Vuelo Nexus v4.6 (Protocolo Omega)

Este es el manual operativo oficial para la gestión del ecosistema Nexus v4.6.

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

### 3. La Armería: Táctica y Protocolo (Novedad v4.6) 🛡️
- **Táctica (Injection)**: No confíes solo en el prompt general. Usa la inyección táctica de cada herramienta para decirle al agente *cuándo* ser agresivo en la búsqueda o *cuándo* derivar a un humano.
- **Protocolo de Extracción**: Configura la extracción de datos para que el agente no escupa JSON crudo. Dile que extraiga solo lo que el cliente valorará (ej: "Solo precio y stock").
- **Plantillas Recomendadas**: Usa el botón "Cargar Plantilla" para aplicar configuraciones probadas en campo para cada herramienta del sistema.

### 4. Agentes: Refinamiento con GPT-4o 🧠
- **Protocolo Omega**: Al crear un agente, el prompt base se pre-carga con las reglas de seguridad de Nexus.
- **Botón Sparkle (Mejorar con IA)**: Si no eres experto en prompts, pega tu idea básica y presiona los destellos. El orquestador usará GPT-4o para convertir tu texto en un Protocolo de actuación de alto nivel.
- **Canales Dinámicos**: Elige en qué redes operará cada agente simplemente marcando los check clusters.

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

### C. Filtrado Avanzado (v4.5) 🔍
- **Selector de Canales**: Ahora incluye la opción **"⚠️ Intervención"**.
- **Gestión Táctica**: Al seleccionar esta opción, la lista se filtrará instantáneamente para mostrar solo las conversaciones que tienen el botón de intervención humana activo, permitiéndote ignorar el ruido de los chats automatizados.

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

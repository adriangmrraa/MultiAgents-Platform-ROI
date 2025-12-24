# 🤝 Guía de Flujo de Trabajo y Operaciones (PointCoach)

Este documento detalla los **procedimientos operativos** para mantener, desplegar y configurar el proyecto. Es la guía práctica que acompaña a la documentación técnica de `COMPLETE_PROJECT_DOCS.md`.

---

## 1. 🔄 El Ciclo de Desarrollo (Dev Loop)

Para cualquier cambio en el código, sigue este protocolo estricto:

1.  **Planificación**:
    *   Siempre crea/actualiza un `implementation_plan.md` antes de tocar código.
    *   Espera aprobación del usuario si el cambio es riesgoso o complejo.
2.  **Ejecución**:
    *   Realiza cambios atómicos. Si tocas Backend y Frontend, hazlo en pasos separados si es posible.
    *   Mantén `task.md` actualizado.
3.  **Verificación**:
    *   No asumas que funciona. Verifica logs (`/view-logs` en UI) o respuestas de API.
    *   Si rompes la UI, la prioridad #1 es arreglarla.
4.  **Entrega**:
    *   Haz commit (`git commit`) con mensajes descriptivos.
    *   Actualiza `walkthrough.md` con lo logrado.

---

## 2. 🚀 Guía de Despliegue (EasyPanel)

El proyecto se despliega automáticamente vía GitHub -> EasyPanel.

**Pasos para desplegar cambios:**
1.  Hacer commit y push a `main`:
    ```bash
    git add .
    git commit -m "feat: nueva funcionalidad"
    git push origin main
    ```
2.  EasyPanel detectará el push y construirá las imágenes Docker.
3.  **Verificación**:
    *   Ve a la URL de tu proyecto.
    *   Si hay error 500/502, revisa los logs en la consola de EasyPanel.

**Variables de Entorno Críticas (EasyPanel):**
Asegúrate de que estas variables estén definidas en la sección "Environment" de EasyPanel para el servicio `orchestrator`:
*   `DATABASE_URL`: Conexión a Postgres.
*   `REDIS_URL`: Conexión a Redis.
*   `OPENAI_API_KEY`: Clave global (fallback).
*   `TIENDANUBE_API_KEY` / `TIENDANUBE_STORE_ID`: (Opcional si se usa modo multi-tenant en BD).
*   `MCP_URL`: URL del webhook de n8n.

---

## 3. ⚙️ Configuración de Nueva Tienda (Multi-Tenant)

Para agregar un nuevo cliente (Tienda) al bot:

**Vía Base de Datos (Recomendado):**
1.  Inserta una fila en la tabla `tenants`.
2.  Datos obligatorios:
    *   `store_name`: Nombre visible.
    *   `bot_phone_number`: Número de WhatsApp (Formato: `54911...`). **CRÍTICO**: Debe coincidir con el `to` del webhook de YCloud.
    *   `tiendanube_store_id` y `tiendanube_access_token`: Credenciales de la API.
    *   `system_prompt_template`: El "cerebro" inicial del bot.

**Vía UI (Si está habilitado):**
1.  Ve a `/admin/tenants` (o sección Configuración).
2.  Usa el formulario para crear/editar.

---

## 4. ✋ Configuración de Derivación Humana (Handoff)

Cómo configurar que el bot se apague y avise a un humano:

1.  **Habilitación**:
    *   En la tabla `tenant_human_handoff_config`, setear `enabled = true`.
2.  **Destino**:
    *   Configurar `destination_email`.
    *   Configurar credenciales SMTP (`smtp_host`, `smtp_user`, `smtp_password_encrypted`).
3.  **Triggers (Disparadores)**:
    *   El bot usa la tool `derivhumano` cuando detecta intención (ej: "quiero hablar con alguien").
    *   Puedes forzarlo manualmente desde el Chat de la UI (Botón "Human Override").

---

## 5. 🛠️ Troubleshooting (Solución de Problemas)

**Problema: "El bot no responde en WhatsApp"**
1.  ¿Está el servidor corriendo? Revisa EasyPanel.
2.  ¿Llega el Webhook? Revisa los logs (`POST /chat/webhook`).
    *   Si ves `Tenant not found for phone...`: Revisa que el número en la tabla `tenants` coincida EXACTAMENTE con el que envía YCloud.
3.  ¿Error de OpenAI? Revisa si la API Key es válida.

**Problema: "El bot inventa productos o precios"**
1.  Revisa el `system_prompt_template`.
2.  Asegúrate de que la variable `{STORE_CATALOG_KNOWLEDGE}` se esté inyectando correctamente.
3.  Verifica que la tool `search_specific_products` esté funcionando (mira los logs de `tiendanube_service`).

**Problema: "Los cambios en el código no se ven"**
1.  ¿Hiciste `git push`?
2.  ¿Terminó el deploy en EasyPanel?
3.  Intenta reiniciar el contenedor manualmente si es necesario.

---

## 6. 🧹 Limpieza de Código (Refactoring Workflow)

Si vas a limpiar código (ej: quitar hardcoding):
1.  Identifica todas las ocurrencias (`grep_search`).
2.  Crea un plan de reemplazo seguro (usando `os.getenv` con valores por defecto seguros).
3.  Prueba localmente o verifica que la lógica de fallback funcione.
4.  Avisa al usuario qué variables de entorno NUEVAS necesita agregar en EasyPanel.

# Nexus v5.1 - Sovereign Chatwoot Integration

Este documento detalla la integración de **Chatwoot** bajo el **Protocolo de Soberanía Total (v5.1)**.

---

## 1. Arquitectura de Soberanía Omnicanal

En la v5.1, Chatwoot actúa como el "Cuerpo" (Interfaz de Mensajería) mientras que Nexus es el "Cerebro". La gran diferencia es que la conexión ahora es **Multi-Tenant y Soberana**.

### Flujo de Datos Aislado
1.  **Entrada**: Un webhook llega a `/api/admin/chatwoot/webhook` con un payload que incluye el `account_id` de Chatwoot.
2.  **Identificación Soberana**: El Orquestador busca en la tabla `credentials` qué inquilino tiene vinculado ese `account_id`.
3.  **Aislamiento**: Se despierta al agente con las llaves de OpenAI **propias de ese inquilino** para procesar la respuesta.
4.  **Salida**: La respuesta se envía de vuelta a Chatwoot usando el `Personal Access Token` privado del inquilino, guardado cifrado en la Bóveda.

---

## 2. Configuración de Credenciales (V5.1 Step)

Ya no usamos la variable global `CHATWOOT_API_TOKEN` para todas las tiendas.

1.  **Acceso**: Ve a **Settings > Credenciales**.
2.  **Carga**:
    - **Categoría**: `chatwoot`.
    - **Nombre**: "Chatwoot Primario".
    - **Valor**: Ingresa tu `Personal Access Token` (obtenido en Ajustes de Perfil de Chatwoot).
    - **Scope**: `tenant`.
3.  **Resultado**: Cada tienda puede tener su propia instancia de Chatwoot aislada, garantizando que el soporte humano y la IA no se mezclen entre clientes.

---

## 3. Guía de Configuración Webhook

Para que la comunicación fluya, Nexus genera una URL única por inquilino.

1.  Ve a **Settings > Integraciones**.
2.  Copia tu **Webhook URL Soberana**.
    - Formato: `https://api.tu-nexus.com/api/admin/chatwoot/webhook?access_token=ENC_TOKEN`
3.  En Chatwoot, ve a **Ajustes > Integraciones > Webhooks**.
4.  Pega la URL y suscríbete al evento **"Message Created"**.

---

## 4. Resolución de Problemas Soberanos

### El Agente no responde en Chatwoot
- **Causa**: La API Key de OpenAI del inquilino expiró o no tiene crédito.
- **Diagnóstico**: Revisa los logs del Orquestador. Verás un error de `Credential Authentication Error` vinculado al `tenant_id` específico.
- **Solución**: Actualiza la llave en la **Bóveda de Credenciales**.

### Mensajes duplicados
Nexus v5.1 incluye un **Idempotency Filter**. Se ignora cualquier mensaje que tenga un `message_id` procesado en los últimos 60 segundos por ese mismo inquilino.

---

## 5. Mejoras de Arquitectura v6.2 (Identity Protocol)

### Corrección: "Conversación Conmigo Mismo"
**Problema resuelto**: En versiones anteriores, cuando respondías manualmente desde Chatwoot (Instagram/Facebook), el sistema creaba una conversación duplicada con tu nombre en lugar del cliente.

**Solución v6.2**:
- El webhook ahora identifica correctamente al **cliente real** extrayendo `conversation.meta.sender`.
- Los metadatos de identidad (`customer_name`, `customer_avatar`) se persisten correctamente en la base de datos.
- El nombre del agente nunca sobrescribe el nombre del cliente en el Dashboard.

### Atomic Buffer (Debounce Inteligente)
Para canales sociales donde los clientes envían múltiples mensajes cortos:
- El sistema acumula mensajes durante **16 segundos** antes de procesarlos.
- La IA recibe un contexto consolidado, mejorando la coherencia de las respuestas.
- Reduce costos de tokens al evitar múltiples llamadas fragmentadas.

### Human Handoff Automático
Cuando respondes manualmente desde Chatwoot:
- El sistema detecta el "Eco" automáticamente.
- Activa un **bloqueo de 24 horas** para la IA en ese chat.
- Evita que el bot interrumpa tu conversación con el cliente.

---

**© 2026 Platform AI Solutions - Sovereign Interface Division**

---

## 6. Estado Actual del Proyecto (Enero 2026)

### ✅ Chatwoot: Canal Bidireccional Operativo
**Estado**: Completamente funcional para recepción y envío de mensajes.

**Logros v6.2**:
- Webhook unificado en `/admin/chatwoot/webhook` recibe mensajes de Instagram, Facebook y WebChat.
- Corrección de identidad implementada: los mensajes salientes (Ecos) ya no crean conversaciones duplicadas.
- Atomic Buffer funcionando: mensajes se acumulan 16 segundos antes de procesarse.
- Human Handoff detectado correctamente: bloqueo de 24h cuando el agente humano responde.

**Canales verificados**:
- ✅ Instagram Direct (vía Chatwoot)
- ✅ Facebook Messenger (vía Chatwoot)
- ✅ WebChat (widget nativo de Chatwoot)

---

### ⚠️ Meta OAuth: Pendiente de Validación

**Estado**: Implementación completa, pero sin verificación de persistencia de credenciales.

**Issue conocido**:
- El popup de OAuth de Meta se cierra correctamente.
- **Incertidumbre**: No se ha confirmado si las credenciales se guardan en la base de datos tras el cierre del popup.
- **Acción requerida**: Ejecutar query SQL para verificar persistencia:
  ```sql
  SELECT name, category, scope, tenant_id, created_at 
  FROM credentials 
  WHERE category = 'meta' OR name LIKE '%META%' OR name LIKE '%FACEBOOK%'
  ORDER BY created_at DESC;
  ```
- **Desencriptación**: Si existen, usar la función `decrypt_password()` del Orchestrator para validar los valores.

**Endpoint de conexión**: `/admin/meta/connect`

---

### 🔴 Agentes: No Responden a Mensajes Entrantes

**Estado**: Configuración correcta, pero sin actividad en canales reales.

**Síntomas**:
- Los agentes están **activados** en el Dashboard.
- El Wizard de configuración muestra datos correctos (canales, herramientas, modelo).
- El **Chat de Prueba** (test interno) funciona correctamente.
- **Problema**: Los agentes NO responden a mensajes entrantes en canales reales (Instagram, Facebook, WhatsApp).

**Diagnóstico pendiente**:
1. Verificar logs del Orchestrator para confirmar si el webhook está recibiendo mensajes.
2. Confirmar que el `tenant_id` del agente coincide con el `tenant_id` de las credenciales de Chatwoot.
3. Validar que el campo `channels` en la tabla `agents` incluye el canal correcto (ej: `["instagram", "facebook"]`).
4. Revisar si el motor de IA (`execute_agent_v3_logic`) se está disparando tras el Atomic Buffer.

**Query de diagnóstico**:
```sql
SELECT id, name, role, channels, is_active, tenant_id 
FROM agents 
WHERE is_active = true;
```

**Próximos pasos**:
- Habilitar logging detallado en `admin_routes.py` (webhook receiver).
- Enviar un mensaje de prueba desde Instagram y capturar el payload completo.
- Verificar que el `process_buffer_task` se está ejecutando correctamente.

---

**Última actualización**: 27 de Enero, 2026 - 01:30 AM (Zona horaria: UTC-3)

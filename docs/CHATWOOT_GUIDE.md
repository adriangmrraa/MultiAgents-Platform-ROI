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

**© 2026 Platform AI Solutions - Sovereign Interface Division**

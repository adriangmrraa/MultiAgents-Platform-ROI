# USER_ONBOARDING_LOGIC.md (Flujo de Inicio)

## Concepto: "Agente Nativo"
Nexus v5.30 elimina la barrera de entrada ("Cold Start Problem") mediante la creación automática de un Agente de Ventas pre-configurado apenas se detecta una tienda válida.

## Lógica de Detección

### 1. Conexión de Tienda
Cuando el usuario conecta Tiendanube (o cualquier Store Provider) en `/onboarding`, el backend:
1.  Verifica las credenciales.
2.  Extrae metadatos de la tienda (Nombre, Slogan, Email).
3.  **Trigger Automático**: Se invoca a `create_sales_agent_if_not_exists(tenant_id)`.

### 2. Auto-Configuración
El sistema utiliza la plantilla `SalesTemplate` para generar el agente:
*   **Nombre**: "Agente de Ventas (IA)"
*   **Rol**: `sales`
*   **Herramientas**: `['search_specific_products', 'orders', 'search_knowledge_base']`
*   **System Prompt**: Se pre-llena con los metadatos de la tienda.
    *   *Descripcíon*: Se inyecta la "Descripción del Negocio" obtenida de la API de la tienda (si existe) o un placeholder inteligente.

## Flujo de UI (Agents.tsx)
1.  **Banner de Activación**: Si el usuario no tiene agente de ventas activo, `Agents.tsx` muestra un banner premium "Activar Agente de Ventas".
2.  **Actualización v5.37 (Channel Modal)**:
    *   **One-Click Activation**: El usuario hace clic en activar.
    *   **Backend Fix**: Se llama a `get_or_create` (garantizado 200 OK, sin errores 404).
    *   **Selección de Canales (Nuevo Paso)**: Antes de ir al Wizard, se abre un Modal para vincular el agente a WhatsApp/IG inmediatamente.
    *   **Redirección**: Solo tras guardar canales se viaja a `/agents/{id}`.

## Beneficio
El usuario pasa de "Conectar Tienda" a "Probar Chat" en menos de 3 clics, con un agente que ya conoce sus productos.

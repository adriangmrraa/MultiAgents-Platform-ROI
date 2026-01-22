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
2.  **One-Click Activation**:
    *   Al hacer clic, el frontend llama a `GET /admin/agents/sales-config/{tenant_id}`.
    *   Si el agente ya existía (creado por el backend en background), se devuelve su ID.
    *   Si no, se crea en el momento.
3.  **Redirección Inmediata**: El usuario es llevado directamente al `Dynamic Wizard` (`/admin/agents/{id}`) para personalizar el Tono y las Reglas, saltando la configuración técnica (Modelo, Temperatura, etc.).

## Beneficio
El usuario pasa de "Conectar Tienda" a "Probar Chat" en menos de 3 clics, con un agente que ya conoce sus productos.

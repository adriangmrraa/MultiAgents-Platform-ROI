# Especificación: Agent Metadata & Vault Sync (v7.1)

## 1. Contexto y Objetivos
- **Problema:** 
    - La gestión de `bot_phone_number` en el modal de Tiendas genera confusión y duplicidad con Canales.
    - Los metadatos de negocio (`store_website`, `store_description`, `store_catalog_knowledge`) están anclados al Tenant, impidiendo que diferentes agentes de una misma tienda tengan identidades distintas.
    - Las credenciales de TiendaNube no se guardan en el Vault (`credentials`), lo que reduce la seguridad y consistencia.
- **Solución:** 
    - Centralizar la gestión de números en **Canales**.
    - Mover metadatos al **Agent Wizard** (columna `metadata` de la tabla `agents`).
    - Sincronizar credenciales de TiendaNube al **Vault** con encriptación AES-256.
- **KPIs:** 
    - Eliminación de la columna `tiendanube_access_token` de la tabla `tenants` (en fase v7.2).
    - Cero pérdida de datos durante la migración de metadatos.
    - 100% de las nuevas tiendas creadas sincronizan credenciales al Vault automáticamente.

## 2. Esquemas de Datos

### 2.1 Metadata del Agente (JSONB en `agents.metadata`)
```typescript
interface AgentMetadataV7_1 {
  website_url?: string;
  catalog_knowledge?: string;
  business_description?: string;
  // Otros campos existentes se preservan
}
```

### 2.2 Vault Sync (Tabla `credentials`)
- **Category:** `tiendanube`
- **Name:** `access_token` | `store_id`
- **Scope:** `tenant`
- **Value:** Encriptado con Fernet (AES-256).

### 2.3 Persistencia (Cambios en DB)
- **Migración SQL:**
    - Insertar datos de `tenants` (`store_website`, `store_description`, `store_catalog_knowledge`) en `agents.metadata` para todos los agentes vinculados.
    - Poblar la tabla `credentials` con los tokens y IDs existentes en `tenants`.

## 3. Lógica de Negocio (Invariantes)
- **Sincronización:** SI se actualiza TiendaNube en el modal de Tiendas, ENTONCES se debe actualizar o crear la entrada correspondiente en el Vault.
- **Prioridad de Metadatos:** SI un agente tiene definido un `website_url` en su metadata, ENTONCES el prompt del sistema debe usar ese valor sobre cualquier fallback.
- **Seguridad:** RESTRICCIÓN: El `tiendanube_access_token` NUNCA debe viajar en texto plano fuera del orquestador (excepto al guardarse desde el Admin).
- **Consolidación:** RESTRICCIÓN: Solo debe existir un endpoint `PUT /admin/tenants/{tenant_id}` funcional.

## 4. Stack y Restricciones
- **Backend:** FastAPI, SQLAlchemy (Async), Cryptography (Fernet).
- **Frontend:** React 18, Tailwind CSS, DynamicAgentWizard.
- **Soberanía:** El Vault asegura que las credenciales de TiendaNube estén aisladas por `tenant_id`.

## 5. Criterios de Aceptación (Gherkin)

### Escenario 1: Sincronización de Credenciales
- **DADO** que estoy en el modal de Edición de Tienda
- **CUANDO** ingreso un nuevo `tiendanube_access_token` y guardo
- **ENTONCES** se crea/actualiza un registro en la tabla `credentials` con category='tiendanube'
- **Y** el valor se guarda encriptado.

### Escenario 2: Independencia de Agentes
- **DADO** una tienda con dos agentes (Ventas y Soporte)
- **CUANDO** configuro una `business_description` diferente en el Agent Wizard para cada uno
- **ENTONCES** cada agente usa su propia descripción en el prompt del sistema.

### Escenario 3: Limpieza de UI
- **DADO** el modal de Gestión de Tiendas
- **CUANDO** visualizo los campos disponibles
- **ENTONCES** el campo "Teléfono del Bot" NO está presente.

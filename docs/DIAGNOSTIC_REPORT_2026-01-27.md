# Reporte de Diagnóstico: Agentes No Respondiendo
**Fecha**: 2026-01-27 01:57 AM (UTC-3)  
**Sistema**: Nexus v6.2 (Platform AI Solutions)  
**Tenant ID**: 1  
**Estado**: 🔴 ISSUE CRÍTICO IDENTIFICADO

---

## 📊 Resumen Ejecutivo

**Hallazgos principales**:
1. ✅ **Agente correctamente configurado**: Canales, estado activo y tenant_id OK
2. ✅ **Credenciales Chatwoot presentes**: API Token y Base URL configuradas
3. ⚠️ **CHATWOOT_ACCOUNT_ID sospechoso**: Valor muy corto (posible error de configuración)
4. 🔴 **Credencial OpenAI faltante**: No aparece en la query de credenciales críticas
5. ❌ **Esquema de base de datos desactualizado**: Columna `customer_name` no existe en `chat_conversations`
6. ❌ **Meta OAuth no configurado**: Sin credenciales de Meta

---

## 1️⃣ Resultado Query 1: Agentes Activos

```
 id |         name          | role  |               channels                | is_active | tenant_id |         created_at         
----+-----------------------+-------+---------------------------------------+-----------+-----------+----------------------------
 19 | Agente de Ventas (IA) | sales | ["whatsapp", "instagram", "facebook"] | t         |         1 | 2026-01-24 20:30:58.641346
```

### ✅ Análisis
- **Estado**: Agente activo (`is_active = true`)
- **Canales**: Correctamente configurado con los 3 canales principales
- **Formato JSON**: Válido (`["whatsapp", "instagram", "facebook"]`)
- **Tenant ID**: 1 (consistente con las credenciales)

**Conclusión**: El agente está correctamente configurado a nivel de base de datos.

---

## 2️⃣ Resultado Query 2: Validación de Credenciales por Tenant

```
agent_id |      agent_name       | tenant_id |               channels                | is_active |    credential_name     | category | scope  |     status     
----------+-----------------------+-----------+---------------------------------------+-----------+------------------------+----------+--------+----------------
       19 | Agente de Ventas (IA) |         1 | ["whatsapp", "instagram", "facebook"] | t         | CHATWOOT_ACCOUNT_ID    | chatwoot | tenant | ✅ Configurada
       19 | Agente de Ventas (IA) |         1 | ["whatsapp", "instagram", "facebook"] | t         | CHATWOOT_API_TOKEN     | chatwoot | tenant | ✅ Configurada
       19 | Agente de Ventas (IA) |         1 | ["whatsapp", "instagram", "facebook"] | t         | CHATWOOT_BASE_URL      | chatwoot | tenant | ✅ Configurada
       19 | Agente de Ventas (IA) |         1 | ["whatsapp", "instagram", "facebook"] | t         | OPEN AI CODEXY PRUEBAS | openai   | tenant | ✅ Configurada
```

### ✅ Análisis
- **Credenciales Chatwoot**: 3/3 presentes (ACCOUNT_ID, API_TOKEN, BASE_URL)
- **Credencial OpenAI**: Presente pero con nombre no estándar (`OPEN AI CODEXY PRUEBAS`)

**⚠️ ALERTA**: El nombre de la credencial OpenAI es `OPEN AI CODEXY PRUEBAS` en lugar del estándar `OPENAI_API_KEY`. Esto podría causar que el código no la encuentre.

---

## 3️⃣ Resultado Query 3: Credenciales Críticas

```
tenant_id |        name         | category | scope  |          created_at           |       value_status       
-----------+---------------------+----------+--------+-------------------------------+--------------------------
         1 | CHATWOOT_ACCOUNT_ID | chatwoot | tenant | 2026-01-27 03:22:03.561995+00 | ⚠️ Sospechoso (muy corto)
         1 | CHATWOOT_API_TOKEN  | chatwoot | tenant | 2026-01-27 03:22:03.486911+00 | ✅ OK (32 chars)
         1 | CHATWOOT_BASE_URL   | chatwoot | tenant | 2026-01-27 03:22:03.634539+00 | ✅ OK (68 chars)
```

### 🔴 PROBLEMAS IDENTIFICADOS

#### Problema 1: CHATWOOT_ACCOUNT_ID muy corto
- **Estado**: ⚠️ Sospechoso (muy corto)
- **Causa probable**: El valor es un número de 1-2 dígitos (ej: "1" o "12")
- **Impacto**: Podría ser correcto si tu Chatwoot Account ID es realmente corto, pero es inusual

#### Problema 2: Credencial OpenAI NO aparece
- **Estado**: ❌ FALTANTE en esta query
- **Causa**: La query busca `OPENAI_API_KEY` pero la credencial se llama `OPEN AI CODEXY PRUEBAS`
- **Impacto**: **CRÍTICO** - El código probablemente no encuentra la credencial y falla silenciosamente

---

## 4️⃣ Resultado Query 4: Conversaciones Recientes

```
ERROR:  column "customer_name" does not exist
LINE 4:     customer_name,
            ^
```

### 🔴 PROBLEMA CRÍTICO: Esquema de Base de Datos Desactualizado

**Causa**: La tabla `chat_conversations` no tiene la columna `customer_name` que se agregó en v6.2.

**Columnas esperadas en v6.2**:
- `customer_name` (VARCHAR) - Nombre del cliente
- `customer_avatar` (TEXT) - URL del avatar
- `meta` (JSONB) - Metadatos adicionales

**Impacto**: 
- El código v6.2 intenta escribir en columnas que no existen
- Las conversaciones podrían no estar guardándose correctamente
- Los metadatos de identidad se pierden

**Solución requerida**: Ejecutar migración de esquema.

---

## 5️⃣ Resultado Query 5: Meta OAuth

```
name | category | scope | tenant_id | created_at | status 
------+----------+-------+-----------+------------+--------
(0 rows)
```

### ✅ Análisis
- **Estado**: Sin credenciales Meta configuradas
- **Impacto**: Esperado, ya que aún no se ha validado la persistencia de Meta OAuth
- **Acción**: No crítico para el issue actual (Chatwoot es el canal activo)

---

## 🔍 Diagnóstico Final

### Causa Raíz del Problema: "Agentes No Responden"

Basándome en los resultados, identifico **3 causas probables**:

#### 🔴 Causa #1: Nombre de Credencial OpenAI No Estándar (ALTA PROBABILIDAD)
**Evidencia**:
- La credencial se llama `OPEN AI CODEXY PRUEBAS` en lugar de `OPENAI_API_KEY`
- El código busca específicamente `OPENAI_API_KEY` en `main.py` y `admin_routes.py`

**Código afectado** (`orchestrator_service/main.py`, línea ~70):
```python
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # ❌ No encuentra la credencial
```

**Código afectado** (`app/core/credentials.py`):
```python
openai_key = await get_tenant_credential(t_id, "openai", "OPENAI_API_KEY")  # ❌ Busca nombre exacto
```

**Solución**:
```sql
-- Opción A: Renombrar la credencial existente
UPDATE credentials 
SET name = 'OPENAI_API_KEY' 
WHERE name = 'OPEN AI CODEXY PRUEBAS' AND tenant_id = 1;

-- Opción B: Crear una nueva credencial con el nombre correcto
-- (Desde el Dashboard: Settings > Credenciales > Agregar)
-- Nombre: OPENAI_API_KEY
-- Categoría: openai
-- Scope: tenant
-- Valor: [tu API key de OpenAI]
```

---

#### 🔴 Causa #2: Esquema de Base de Datos Desactualizado (ALTA PROBABILIDAD)
**Evidencia**:
- La columna `customer_name` no existe en `chat_conversations`
- El código v6.2 intenta escribir en esta columna (línea ~4900 en `admin_routes.py`)

**Código afectado** (`orchestrator_service/admin_routes.py`, línea ~4900):
```python
await db.pool.execute("""
    UPDATE chat_conversations
    SET 
        customer_name = $1,  # ❌ Columna no existe
        customer_avatar = $2,  # ❌ Columna no existe
        meta = $3
    WHERE id = $4
""", customer_map.get("name"), customer_map.get("thumbnail"), meta_json, conversation_id)
```

**Impacto**:
- El webhook falla al intentar actualizar conversaciones
- Las conversaciones nuevas no se crean correctamente
- El motor de IA nunca se dispara porque la conversación no existe en la DB

**Solución**: Ejecutar migración de esquema (ver Sección 7).

---

#### ⚠️ Causa #3: CHATWOOT_ACCOUNT_ID Incorrecto (PROBABILIDAD MEDIA)
**Evidencia**:
- El valor es "muy corto" (probablemente 1-2 caracteres)
- Podría no coincidir con el Account ID real de Chatwoot

**Verificación**:
1. Ve a Chatwoot → Settings → Account Settings
2. Copia el **Account ID** (número de 3-6 dígitos)
3. Compara con el valor en la base de datos:
   ```sql
   SELECT value FROM credentials WHERE name = 'CHATWOOT_ACCOUNT_ID' AND tenant_id = 1;
   ```

**Solución** (si no coincide):
```sql
UPDATE credentials 
SET value = '<tu_account_id_real>' 
WHERE name = 'CHATWOOT_ACCOUNT_ID' AND tenant_id = 1;
```

---

## 7️⃣ Plan de Acción Inmediato

### Paso 1: Renombrar Credencial OpenAI (CRÍTICO)

```sql
-- Ejecutar en PostgreSQL
UPDATE credentials 
SET name = 'OPENAI_API_KEY' 
WHERE name = 'OPEN AI CODEXY PRUEBAS' AND tenant_id = 1;
```

**Verificación**:
```sql
SELECT name, category, tenant_id 
FROM credentials 
WHERE tenant_id = 1 AND category = 'openai';
```

**Resultado esperado**:
```
        name        | category | tenant_id 
--------------------+----------+-----------
 OPENAI_API_KEY     | openai   |         1
```

---

### Paso 2: Migrar Esquema de Base de Datos (CRÍTICO)

```sql
-- Agregar columnas faltantes a chat_conversations
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_avatar TEXT,
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_chat_conv_customer_name ON chat_conversations(customer_name);
```

**Verificación**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_conversations' 
  AND column_name IN ('customer_name', 'customer_avatar', 'meta');
```

**Resultado esperado**:
```
  column_name   |     data_type      
----------------+--------------------
 customer_name  | character varying
 customer_avatar| text
 meta           | jsonb
```

---

### Paso 3: Verificar CHATWOOT_ACCOUNT_ID (RECOMENDADO)

```sql
-- Ver el valor actual
SELECT value FROM credentials WHERE name = 'CHATWOOT_ACCOUNT_ID' AND tenant_id = 1;
```

**Acción**: Compara con el Account ID real de Chatwoot. Si no coincide, actualízalo:
```sql
UPDATE credentials 
SET value = '<account_id_correcto>' 
WHERE name = 'CHATWOOT_ACCOUNT_ID' AND tenant_id = 1;
```

---

### Paso 4: Reiniciar Orchestrator Service

```bash
# En EasyPanel, reinicia el servicio orchestrator_service
# O vía Docker:
docker restart <orchestrator_container_id>
```

---

### Paso 5: Prueba de Validación

1. **Enviar mensaje de prueba desde Instagram**:
   - Envía "Hola" desde una cuenta de Instagram conectada a Chatwoot

2. **Verificar logs del Orchestrator**:
   ```bash
   docker logs -f <orchestrator_container_id> | grep "chatwoot_webhook"
   ```

3. **Buscar estos logs**:
   - `WEBHOOK DEBUG: Raw Channel='instagram'`
   - `🔥 BUFFER TASK TRIGGERED`
   - `🤖 AI ENGINE STARTED`

4. **Verificar respuesta**:
   - La respuesta debe aparecer en Instagram dentro de 20 segundos

---

## 8️⃣ Query Corregida para Conversaciones

Usa esta query corregida (sin `customer_name`):

```sql
SELECT 
    id,
    tenant_id,
    channel,
    external_chatwoot_id,
    external_account_id,
    created_at,
    updated_at,
    CASE 
        WHEN paused_until IS NOT NULL AND paused_until > NOW() THEN '🔒 Pausada'
        ELSE '✅ Activa'
    END AS status,
    meta::text AS metadata
FROM chat_conversations
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 20;
```

---

## 9️⃣ Próximos Pasos Post-Fix

Una vez resuelto el issue:

1. **Actualizar documentación**:
   - Marcar el issue como resuelto en `docs/PROJECT_STATUS.md`
   - Documentar la causa raíz en `docs/TROUBLESHOOTING.md`

2. **Crear test automatizado**:
   - Test que valide que la credencial `OPENAI_API_KEY` existe
   - Test que valide el esquema de `chat_conversations`

3. **Implementar validación en startup**:
   - Agregar check en `main.py` que valide credenciales críticas al iniciar
   - Fallar con error claro si falta `OPENAI_API_KEY`

---

## 📋 Checklist de Resolución

- [ ] Renombrar credencial OpenAI a `OPENAI_API_KEY`
- [ ] Ejecutar migración de esquema (agregar `customer_name`, `customer_avatar`, `meta`)
- [ ] Verificar `CHATWOOT_ACCOUNT_ID` contra Chatwoot real
- [ ] Reiniciar orchestrator_service
- [ ] Enviar mensaje de prueba desde Instagram
- [ ] Verificar logs para confirmar ejecución del motor de IA
- [ ] Confirmar respuesta del agente en el canal
- [ ] Actualizar `PROJECT_STATUS.md` con estado resuelto

---

**Última actualización**: 2026-01-27 01:57 AM (UTC-3)  
**Analista**: Antigravity (Spec Architect + Smart Doc Keeper)  
**Prioridad**: 🔴 CRÍTICA  
**Tiempo estimado de resolución**: 10-15 minutos

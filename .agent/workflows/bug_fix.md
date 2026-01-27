---
description: Workflow para solucionar bugs en Platform AI Solutions
---

# 🐛 Bug Fix Workflow - Platform AI Solutions

Proceso estandarizado para diagnosticar y solucionar errores en el sistema multi-tenant.

## 🛠 Skills Recomendadas
Antes de empezar, consulta [agents.md](../agents.md) para seleccionar el experto adecuado.
- **Backend/Seguridad**: [Backend_Sovereign](../skills/Backend_Sovereign/SKILL.md)
- **Frontend/UI**: [Frontend_Nexus](../skills/Frontend_Nexus/SKILL.md)
- **Integrations**: [Meta_Integration_Diplomat](../skills/Meta_Integration_Diplomat/SKILL.md) o [TiendaNube_Commerce_Bridge](../skills/TiendaNube_Commerce_Bridge/SKILL.md)


## Fase 1: Diagnóstico (Gather Evidence)

### 1.1. Recopilar Información
- [ ] **¿Qué error ocurre?** (Mensaje de error, comportamiento inesperado)
- [ ] **¿Dónde ocurre?** (Frontend, Backend, Servicio específico)
- [ ] **¿Cuándo ocurre?** (Siempre, intermitente, condición específica)
- [ ] **¿Afecta a todos los tenants o solo uno?** (Multi-tenant isolation check)

### 1.2. Revisar Logs
```bash
# Logs del orchestrator
docker logs orchestrator_service --tail 100

# Logs de whatsapp service
docker logs whatsapp_service --tail 100

# Logs de agent service
docker logs agent_service --tail 100
```

### 1.3. Verificar Estado del Sistema
- [ ] **Base de Datos**: PostgreSQL accesible
- [ ] **Redis**: Cache funcionando
- [ ] **Supabase**: Vector store conectado
- [ ] **Credenciales**: API keys válidas para el tenant afectado

## Fase 2: Reproducción (Isolate Issue)

### 2.1. Crear Caso de Prueba Mínimo
```python
# Reproducir el error en aislamiento
async def test_bug_reproduction():
    """Debe fallar hasta que se arregle"""
    # Setup
    tenant_id = 1
    
    # Acción que causa el bug
    result = await problematic_function(tenant_id)
    
    # Verificación
    assert result is not None  # Debe pasar después del fix
```

### 2.2. Identificar Componente Afectado
- **Frontend**: Error en UI, console logs, network tab
- **Backend API**: Error HTTP (400, 401, 403, 404, 500)
- **Agent Service**: Fallo en inferencia, tool calls
- **Database**: Query errors, constraint violations
- **External APIs**: OpenAI, Meta, Tienda Nube timeouts

## Fase 3: Análisis (Root Cause)

### 3.1. Errores Comunes por Categoría

#### **Multi-Tenant Isolation**
```python
# Problema: Acceso cross-tenant
# ❌ MAL
stmt = select(Agent).where(Agent.id == agent_id)

# ✅ FIX
stmt = select(Agent).where(
    Agent.id == agent_id,
    Agent.tenant_id == tenant_id
)
```

#### **Credential Vault**
```python
# Problema: Credenciales no encontradas
# Verificar:
creds = await get_tenant_credential(
    tenant_id=tenant_id,
    category="openai"
)
if not creds:
    raise HTTPException(
        status_code=400,
        detail="OpenAI credentials not configured"
    )
```

#### **RAG Híbrido**
```python
# Problema: Documentos huérfanos
# Fix: Dual Delete Protocol
# 1. Eliminar de Supabase
await supabase.from_("documents").delete().eq(
    "metadata->>source_id", doc_id
).execute()

# 2. Eliminar de PostgreSQL
await session.delete(doc)
await session.commit()
```

#### **Tenant Resolution**
```python
# Problema: UUID vs INTEGER mismatch
# Fix: Resolver desde tabla users
user_row = await db.pool.fetchrow(
    "SELECT tenant_id FROM users WHERE id = $1",
    current_user.id  # UUID
)
real_tenant_int = user_row['tenant_id']  # INTEGER
```

### 3.2. Revisar Cambios Recientes
```bash
# Ver últimos commits
git log --oneline -10

# Ver cambios en archivo específico
git log -p -- path/to/file.py
```

## Fase 4: Solución (Fix Implementation)

### 4.1. Implementar Fix
- [ ] Modificar código con la corrección
- [ ] Agregar validación para prevenir recurrencia
- [ ] Agregar logging para debugging futuro

### 4.2. Ejemplo de Fix con Validación
```python
# Antes
async def get_agent(agent_id: int):
    return await session.get(Agent, agent_id)

# Después (con validaciones)
async def get_agent(agent_id: int, tenant_id: int):
    """
    Get agent with multi-tenant validation
    
    Raises:
        HTTPException: 404 if agent not found or access denied
    """
    stmt = select(Agent).where(
        Agent.id == agent_id,
        Agent.tenant_id == tenant_id
    )
    result = await session.execute(stmt)
    agent = result.scalar_one_or_none()
    
    if not agent:
        logger.warning(
            f"Agent {agent_id} not found for tenant {tenant_id}"
        )
        raise HTTPException(
            status_code=404,
            detail="Agent not found or access denied"
        )
    
    return agent
```

## Fase 5: Verificación (Test Fix)

### 5.1. Testing Local
```bash
# Ejecutar tests unitarios
pytest tests/test_agents.py -v

# Ejecutar test específico del fix
pytest tests/test_bug_fix.py::test_specific_bug -v
```

### 5.2. Testing Manual
- [ ] Reproducir escenario original
- [ ] Verificar que el error ya no ocurre
- [ ] Probar edge cases
- [ ] Verificar que no rompió otra funcionalidad

### 5.3. Multi-Tenant Testing
```python
# Verificar aislamiento
async def test_tenant_isolation():
    # Tenant 1 crea agente
    agent1 = await create_agent(tenant_id=1, name="Agent 1")
    
    # Tenant 2 NO debe poder accederlo
    with pytest.raises(HTTPException) as exc:
        await get_agent(agent_id=agent1.id, tenant_id=2)
    
    assert exc.value.status_code == 404
```

## Fase 6: Deployment

### 6.1. Commit Changes
```bash
git add .
git commit -m "fix: [description del bug] - closes #issue_number"
```

### 6.2. Deploy to Staging
```bash
# Push cambios
git push origin main

# Monitorear logs de deployment
# (Render/EasyPanel auto-deploy)
```

### 6.3. Smoke Testing en Staging
- [ ] Verificar fix funciona en staging
- [ ] Revisar logs por errores inesperados
- [ ] Validar performance no degradada

## Fase 7: Post-Mortem (Learn)

### 7.1. Documentar
- **Descripción del Bug**: Qué estaba roto
- **Root Cause**: Por qué ocurrió
- **Fix Implementado**: Qué se cambió
- **Prevención**: Cómo evitarlo en el futuro

### 7.2. Actualizar Documentación
- [ ] Agregar al `TROUBLESHOOTING.md` si es error común
- [ ] Actualizar Skills si es patrón recurrente
- [ ] Crear test de regresión

## Checklist Final

- [ ] Bug reproducido y documentado
- [ ] Root cause identificado
- [ ] Fix implementado con validaciones
- [ ] Tests agregados (unitarios + integración)
- [ ] Multi-tenant isolation verificado
- [ ] Deploy exitoso en staging
- [ ] Smoke testing pasado
- [ ] Documentación actualizada
- [ ] Issue cerrada en GitHub

---

**Tip**: Para bugs críticos de producción, aplicar **Hotfix Protocol**: fix rápido, deploy directo, post-mortem después.

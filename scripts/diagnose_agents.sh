#!/bin/bash
# Script de Diagnóstico para Agentes No Respondiendo
# Platform AI Solutions - Nexus v6.2
# Fecha: 2026-01-27

echo "========================================="
echo "🔍 DIAGNÓSTICO DE AGENTES - NEXUS v6.2"
echo "========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# PASO 1: Verificar Agentes Activos
# ============================================
echo -e "${YELLOW}📋 PASO 1: Verificando agentes activos...${NC}"
echo ""

psql $DATABASE_URL -c "
SELECT 
    id,
    name,
    role,
    channels,
    is_active,
    tenant_id,
    created_at
FROM agents 
WHERE is_active = true
ORDER BY tenant_id, id;
"

echo ""
echo -e "${GREEN}✅ Paso 1 completado${NC}"
echo ""
echo "========================================="
echo ""

# ============================================
# PASO 2: Validar Credenciales por Tenant
# ============================================
echo -e "${YELLOW}🔐 PASO 2: Validando credenciales por tenant...${NC}"
echo ""

psql $DATABASE_URL -c "
SELECT 
    a.id AS agent_id,
    a.name AS agent_name,
    a.tenant_id,
    a.channels,
    a.is_active,
    c.name AS credential_name,
    c.category,
    c.scope,
    CASE 
        WHEN c.value IS NOT NULL THEN '✅ Configurada'
        ELSE '❌ Faltante'
    END AS status
FROM agents a
LEFT JOIN credentials c ON a.tenant_id = c.tenant_id
WHERE a.is_active = true 
  AND c.category IN ('chatwoot', 'openai')
ORDER BY a.tenant_id, c.category, c.name;
"

echo ""
echo -e "${GREEN}✅ Paso 2 completado${NC}"
echo ""
echo "========================================="
echo ""

# ============================================
# PASO 3: Verificar Credenciales Críticas
# ============================================
echo -e "${YELLOW}🔑 PASO 3: Verificando credenciales críticas...${NC}"
echo ""

psql $DATABASE_URL -c "
SELECT 
    tenant_id,
    name,
    category,
    scope,
    created_at,
    CASE 
        WHEN value IS NOT NULL AND LENGTH(value) > 10 THEN '✅ OK (' || LENGTH(value) || ' chars)'
        WHEN value IS NOT NULL AND LENGTH(value) <= 10 THEN '⚠️ Sospechoso (muy corto)'
        ELSE '❌ NULL'
    END AS value_status
FROM credentials
WHERE name IN (
    'OPENAI_API_KEY',
    'CHATWOOT_API_TOKEN',
    'CHATWOOT_BASE_URL',
    'CHATWOOT_ACCOUNT_ID',
    'CHATWOOT_BOT_TOKEN'
)
ORDER BY tenant_id, category, name;
"

echo ""
echo -e "${GREEN}✅ Paso 3 completado${NC}"
echo ""
echo "========================================="
echo ""

# ============================================
# PASO 4: Verificar Conversaciones Recientes
# ============================================
echo -e "${YELLOW}💬 PASO 4: Verificando conversaciones recientes...${NC}"
echo ""

psql $DATABASE_URL -c "
SELECT 
    id,
    tenant_id,
    customer_name,
    channel,
    external_chatwoot_id,
    external_account_id,
    created_at,
    updated_at,
    CASE 
        WHEN paused_until IS NOT NULL AND paused_until > NOW() THEN '🔒 Pausada'
        ELSE '✅ Activa'
    END AS status
FROM chat_conversations
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 20;
"

echo ""
echo -e "${GREEN}✅ Paso 4 completado${NC}"
echo ""
echo "========================================="
echo ""

# ============================================
# PASO 5: Verificar Mapeo Chatwoot
# ============================================
echo -e "${YELLOW}🔗 PASO 5: Verificando mapeo Chatwoot...${NC}"
echo ""

psql $DATABASE_URL -c "
SELECT 
    c.tenant_id,
    c.name AS credential_name,
    c.value AS chatwoot_account_id,
    COUNT(conv.id) AS conversaciones_activas
FROM credentials c
LEFT JOIN chat_conversations conv ON c.tenant_id = conv.tenant_id
WHERE c.name = 'CHATWOOT_ACCOUNT_ID'
GROUP BY c.tenant_id, c.name, c.value
ORDER BY c.tenant_id;
"

echo ""
echo -e "${GREEN}✅ Paso 5 completado${NC}"
echo ""
echo "========================================="
echo ""

# ============================================
# PASO 6: Verificar Meta OAuth (Opcional)
# ============================================
echo -e "${YELLOW}📱 PASO 6: Verificando credenciales Meta OAuth...${NC}"
echo ""

psql $DATABASE_URL -c "
SELECT 
    name,
    category,
    scope,
    tenant_id,
    created_at,
    CASE 
        WHEN value IS NOT NULL THEN '✅ Configurada'
        ELSE '❌ Faltante'
    END AS status
FROM credentials 
WHERE category = 'meta' 
   OR name LIKE '%META%' 
   OR name LIKE '%FACEBOOK%'
   OR name LIKE '%INSTAGRAM%'
ORDER BY created_at DESC;
"

echo ""
echo -e "${GREEN}✅ Paso 6 completado${NC}"
echo ""
echo "========================================="
echo ""

# ============================================
# RESUMEN FINAL
# ============================================
echo -e "${YELLOW}📊 RESUMEN DE DIAGNÓSTICO${NC}"
echo ""

psql $DATABASE_URL -c "
WITH agent_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE is_active = true) AS agentes_activos,
        COUNT(*) FILTER (WHERE is_active = false) AS agentes_inactivos,
        COUNT(DISTINCT tenant_id) AS tenants_con_agentes
    FROM agents
),
credential_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE category = 'openai') AS openai_keys,
        COUNT(*) FILTER (WHERE category = 'chatwoot') AS chatwoot_keys,
        COUNT(*) FILTER (WHERE category = 'meta') AS meta_keys,
        COUNT(DISTINCT tenant_id) AS tenants_con_credenciales
    FROM credentials
),
conversation_stats AS (
    SELECT 
        COUNT(*) AS conversaciones_totales,
        COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '24 hours') AS conversaciones_24h,
        COUNT(DISTINCT tenant_id) AS tenants_con_conversaciones
    FROM chat_conversations
)
SELECT 
    'Agentes Activos' AS metrica, 
    a.agentes_activos::TEXT AS valor
FROM agent_stats a
UNION ALL
SELECT 
    'Agentes Inactivos', 
    a.agentes_inactivos::TEXT
FROM agent_stats a
UNION ALL
SELECT 
    'Tenants con Agentes', 
    a.tenants_con_agentes::TEXT
FROM agent_stats a
UNION ALL
SELECT 
    'Credenciales OpenAI', 
    c.openai_keys::TEXT
FROM credential_stats c
UNION ALL
SELECT 
    'Credenciales Chatwoot', 
    c.chatwoot_keys::TEXT
FROM credential_stats c
UNION ALL
SELECT 
    'Credenciales Meta', 
    c.meta_keys::TEXT
FROM credential_stats c
UNION ALL
SELECT 
    'Conversaciones (24h)', 
    co.conversaciones_24h::TEXT
FROM conversation_stats co;
"

echo ""
echo "========================================="
echo -e "${GREEN}✅ DIAGNÓSTICO COMPLETADO${NC}"
echo "========================================="
echo ""
echo "📝 Próximos pasos:"
echo "1. Revisa si los agentes tienen el campo 'channels' correctamente configurado"
echo "2. Verifica que cada tenant tenga OPENAI_API_KEY y CHATWOOT_API_TOKEN"
echo "3. Confirma que external_chatwoot_id y external_account_id estén poblados"
echo "4. Revisa los logs del orchestrator_service para errores de webhook"
echo ""

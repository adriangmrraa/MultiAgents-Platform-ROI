# Nexus v5.1 - Protocol Omega
# Orchestrator Service Main Entry

import os
from dotenv import load_dotenv

# Initialize Early (Protocol Omega: Env loading MUST happen before any module initialization)
load_dotenv()

import json
import hashlib
import time
import uuid
import requests
import re
import structlog
import httpx
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.utils import formatdate
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union, Literal
from fastapi import FastAPI, HTTPException, Header, Depends, status, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from contextvars import ContextVar
from pydantic import BaseModel, Field

# Safety Protocols: Rate Limiting
from app.middleware.rate_limit import RateLimitMiddleware # Import Middleware

# PROTOCOL OMEGA DEPLOYMENT TRACKER
print(">> SYSTEM STARTUP: Protocol Omega v5.9.129 (Stream+SQL Fix Loaded)")

# --- Imports ---
from app.core.tenant import TenantContext
from app.api.deps import get_current_tenant_webhook, get_current_tenant_header
from app.models.customer import Customer # Schema Drift Prevention
from app.models.template import WhatsAppTemplate # v5.42 WhatsApp Module
from app.models.rag import Document # v5.48 RAG Collections
from app.workers.shadow_indexer import ShadowIndexer # v5.32 Shadow RAG

# --- Dynamic Context ---
tenant_store_id: ContextVar[Optional[str]] = ContextVar("tenant_store_id", default=None)
tenant_access_token: ContextVar[Optional[str]] = ContextVar("tenant_access_token", default=None)
current_tenant_id: ContextVar[Optional[int]] = ContextVar("current_tenant_id", default=None)
current_conversation_id: ContextVar[Optional[uuid.UUID]] = ContextVar("current_conversation_id", default=None)
current_customer_phone: ContextVar[Optional[str]] = ContextVar("current_customer_phone", default=None)

try:
    from langchain.agents import AgentExecutor, create_openai_functions_agent
except ImportError:
    from langchain.agents.agent import AgentExecutor
    from langchain.agents import create_openai_functions_agent

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import tool
from langchain.memory import ConversationBufferMemory
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from db import db, redis_client
from app.core.credentials import get_tenant_credential, get_tenant_credential_by_type 
from app.core.db_setup import background_db_setup  # Nexus v5.9 Self-Healing

# Configuration & Environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
POSTGRES_DSN = os.getenv("POSTGRES_DSN")

# Fallback Tienda Nube credentials (from Env Vars)
GLOBAL_TN_STORE_ID = os.getenv("TIENDANUBE_STORE_ID") or os.getenv("GLOBAL_TN_STORE_ID")
GLOBAL_TN_ACCESS_TOKEN = os.getenv("TIENDANUBE_ACCESS_TOKEN") or os.getenv("GLOBAL_TN_ACCESS_TOKEN")

# Service URLs & Feature Flags (Nexus v3 Decentralized Architecture)
NEXUS_V3_ENABLED = os.getenv("NEXUS_V3_ENABLED", "true").lower() == "true"
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://agent_service:8001")
TIENDANUBE_SERVICE_URL = os.getenv("TIENDANUBE_SERVICE_URL", "http://tiendanube_service:8003")
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL")
if not WHATSAPP_SERVICE_URL:
    # Use underscore as primary, will fallback to dash in unified_message_delivery if needed
    WHATSAPP_SERVICE_URL = "http://whatsapp_service:8002"
INTERNAL_SECRET_KEY = os.getenv("INTERNAL_API_TOKEN") or os.getenv("INTERNAL_SECRET_KEY")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "agente-js-secret-key-2024")

from app.core.config import settings

# Global Fallback Content (only used if DB has no specific tenant config)
GLOBAL_STORE_DESCRIPTION = os.getenv("GLOBAL_STORE_DESCRIPTION")
GLOBAL_CATALOG_KNOWLEDGE = os.getenv("GLOBAL_CATALOG_KNOWLEDGE")
GLOBAL_SYSTEM_PROMPT = os.getenv("GLOBAL_SYSTEM_PROMPT")

# Protocol Omega Ready

# Initialize Structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()


# --- Shared Models ---
class ToolError(BaseModel):
    code: str = Field(..., description="Error code")
    message: str
    retryable: bool
    details: Optional[Dict[str, Any]] = None


class MediaObject:
    def __init__(self, url, provider_id, m_type, mime=None, filename=None):
        self.url = url
        self.provider_id = str(provider_id)
        self.type = m_type # image, video, audio, file
        self.mime_type = mime
        self.file_name = filename

class SimpleEvent:
    def __init__(self, from_num, text, msg_id, channel_source='whatsapp', external_cw_id=None, external_acc_id=None, tenant_id=None, media=None, event_type="message"):
        self.from_number = str(from_num) if from_num is not None else None
        self.text = str(text) if text is not None else ""
        self.event_id = str(msg_id) if msg_id is not None else None
        self.customer_name = from_num # Fallback
        self.event_type = event_type
        self.media = media or []
        self.correlation_id = str(uuid.uuid4())
        self.channel_source = channel_source
        self.external_chatwoot_id = external_cw_id
        self.external_account_id = external_acc_id
        self.tenant_id = tenant_id
        self.role = 'user' # Default

# FastAPI App
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse
from utils import encrypt_password, decrypt_password
from admin_routes import router as admin_router, sync_environment
from app.routes.auth_routes import router as auth_router
from app.routes.platform_routes import router as platform_router
from app.routes.ingest_routes import router as ingest_router # NEW
from app.api.onboarding import router as onboarding_router # Hyper-Onboarding
from app.api.onboarding import router as onboarding_router # Hyper-Onboarding


from app.core.database import AsyncSessionLocal, engine
from app.core.init_data import init_db

# (Redundant app instance removed for Protocol Omega v5.4)

# --- Auto-Migration for EasyPanel (Raw SQL Steps) ---
# Since the db/ folder isn't copied to the container, we inline critical schema here.
migration_steps = [
    # 1. Tenants Table
    """
    CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        store_name TEXT NOT NULL,
        bot_phone_number TEXT UNIQUE NOT NULL,
        owner_email TEXT,
        store_location TEXT,
        store_website TEXT,
        store_description TEXT,
        store_catalog_knowledge TEXT,
        tiendanube_store_id TEXT,
        tiendanube_access_token TEXT,
        system_prompt_template TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    # 1b. Tenants Repair (Ensure Branding Columns)
    """
    DO $$
    BEGIN
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS store_location TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS store_website TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS store_description TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS store_catalog_knowledge TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiendanube_store_id TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tiendanube_access_token TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS system_prompt_template TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_enabled BOOLEAN DEFAULT FALSE;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_instructions TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_target_email TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_message TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_host TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_user TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_pass TEXT;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_smtp_port INTEGER;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS handoff_policy JSONB DEFAULT '{}';
        
        -- Nexus v3: OpenAI Override per Tenant
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS openai_api_key VARCHAR(255);
        
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE tenants ALTER COLUMN is_active SET DEFAULT TRUE;
        UPDATE tenants SET is_active = TRUE WHERE is_active IS NULL;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Schema repair failed for tenants';
    END $$;
    """,
    # 2. Users Table Evolution (Zero Trust)
    """
    DO $$
    BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
        
        -- Legacy Migration: DISABLED to prevent auto-verification during development
        -- UPDATE users SET is_verified = TRUE WHERE is_verified IS FALSE AND created_at < NOW() - INTERVAL '1 minute';
    END $$;
    """,
    # 1c. Pre-clean Handoff Config
    """
    DO $$
    BEGIN
        -- If table exists but lacks PK (broken state from previous edits), drop it to allow fresh creation.
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenant_human_handoff_config') 
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_human_handoff_config_pkey') THEN
           
           DROP TABLE tenant_human_handoff_config CASCADE;
        END IF;
    END $$;
    """,
    # 1c. Tenant Human Handoff Config (Final Spec + Consistency)
    """
    CREATE TABLE IF NOT EXISTS tenant_human_handoff_config (
        tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        destination_email TEXT NOT NULL,
        handoff_instructions TEXT, 
        handoff_message TEXT,
        smtp_host TEXT NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_security TEXT NOT NULL DEFAULT 'SSL', -- SSL | STARTTLS | NONE
        smtp_username TEXT NOT NULL,
        smtp_password_encrypted TEXT NOT NULL,
        triggers JSONB NOT NULL DEFAULT '{}',
        email_context JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    """,
    # Nexus v5.99: Data Integrity (Agents Schema)
    """
    DO $$
    BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) DEFAULT 'custom';
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS knowledge_sources JSONB DEFAULT '[]';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Schema repair failed for agents schema extension';
    END $$;
    """,
    # 2. Credentials Table (Nexus v3.1: UUID Migration)
    """
    CREATE TABLE IF NOT EXISTS credentials (
        id_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id SERIAL, -- Legacy support
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        scope TEXT DEFAULT 'global',
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    # 3. Credentials Repair (UUID Migration & Uniqueness)
    """
    DO $$ 
    BEGIN 
        -- 1. Add id_uuid if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='id_uuid') THEN
            ALTER TABLE credentials ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid();
        END IF;

        -- 2. Populate id_uuid for legacy rows
        UPDATE credentials SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;

        -- 3. Set Primary Key (Sacred Step 3)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='id') THEN
            -- Check if 'id' is currently the PK
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_pkey') THEN
                ALTER TABLE credentials DROP CONSTRAINT credentials_pkey;
            END IF;
            -- Set new PK
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_pkey') THEN
                ALTER TABLE credentials ADD PRIMARY KEY (id_uuid);
            END IF;
        END IF;

        -- 4. Defaults & Resilience
        ALTER TABLE credentials ALTER COLUMN category SET DEFAULT 'general';
        ALTER TABLE credentials ALTER COLUMN scope SET DEFAULT 'global';
        ALTER TABLE credentials ALTER COLUMN updated_at SET DEFAULT NOW();
        
        -- Fix Uniqueness for Multi-Tenancy (Protocol Omega)
        -- We want (name, tenant_id) to be unique so different tenants can use "My Key"
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_credentials_name_tenant') THEN
             -- Replace if exists to ensure correct columns
             ALTER TABLE credentials DROP CONSTRAINT uq_credentials_name_tenant;
        END IF;
        
        -- To handle NULL tenant_id (global) and still have uniqueness, 
        -- we use a partial index or a COALESCE logic.
        -- Partial Index for Global:
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_credentials_global_unique') THEN
            CREATE UNIQUE INDEX idx_credentials_global_unique ON credentials (name) WHERE tenant_id IS NULL;
        END IF;
        -- Unique for Tenant:
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_credentials_name_tenant') THEN
            ALTER TABLE credentials ADD CONSTRAINT uq_credentials_name_tenant UNIQUE (name, tenant_id);
        END IF;
        -- Check for name column (Fix for bootstrap error)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='name') THEN
            ALTER TABLE credentials ADD COLUMN name TEXT;
        END IF;

        -- Check for value column (Fix for bootstrap error)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='value') THEN
            ALTER TABLE credentials ADD COLUMN value TEXT;
        END IF;

        -- Check for category column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='category') THEN
            ALTER TABLE credentials ADD COLUMN category TEXT;
        END IF;

        -- Check for scope column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='scope') THEN
            ALTER TABLE credentials ADD COLUMN scope TEXT DEFAULT 'global';
        END IF;

        -- Check for description column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='description') THEN
            ALTER TABLE credentials ADD COLUMN description TEXT;
        END IF;

        -- Check for updated_at column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='updated_at') THEN
            ALTER TABLE credentials ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        END IF;

        -- Fix Legacy NOT NULL violations (Omega Phase 3)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='service_name') THEN
            ALTER TABLE credentials ALTER COLUMN service_name DROP NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='provider') THEN
            ALTER TABLE credentials ALTER COLUMN provider DROP NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credentials' AND column_name='api_key_encrypted') THEN
            ALTER TABLE credentials ALTER COLUMN api_key_encrypted DROP NOT NULL;
        END IF;

        -- Check for UNIQUE constraint (name, scope)
        -- CRITICAL FIX: The previous constraint UNIQUE(name, scope) was wrong because it prevented 
        -- multiple tenants from having the same credential name (e.g. 'OPENAI_API_KEY' with scope 'tenant').
        -- We must drop it and use partial indexes or include tenant_id.
        
        IF EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'unique_name_scope' AND conrelid = 'credentials'::regclass
        ) THEN
            ALTER TABLE credentials DROP CONSTRAINT unique_name_scope;
        END IF;

        -- Create proper indexes for uniqueness
        -- 1. Global uniqueness: One key per name where scope is global
        CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_global_unique 
        ON credentials (name) WHERE scope = 'global';

        -- 2. Tenant uniqueness: One key per name per tenant where scope is tenant
        CREATE UNIQUE INDEX IF NOT EXISTS idx_credentials_tenant_unique 
        ON credentials (name, tenant_id) WHERE scope = 'tenant';
    END $$;
    """,
    # 4. PGCryto Extension
    """
    DO $$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not create extension pgcrypto';
    END $$;
    """,
    # 5. Chat Conversations
    """
    CREATE TABLE IF NOT EXISTS chat_conversations (
        id UUID PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id),
        channel VARCHAR(32) NOT NULL, 
        channel_source VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
        external_user_id VARCHAR(128) NOT NULL,
        display_name VARCHAR(255),
        avatar_url TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        human_override_until TIMESTAMPTZ,
        last_message_at TIMESTAMPTZ,
        last_message_preview TEXT,
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (channel, external_user_id) 
    );
    """,
    # 6. Chat Conversations Repair
    """
    DO $$
    BEGIN
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS channel_source VARCHAR(32) DEFAULT 'whatsapp';
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS human_override_until TIMESTAMPTZ;
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id); -- Fix Identity Link
        
        -- Origin Metadata v1.0
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS platform_origin VARCHAR(32);
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS source_identifier VARCHAR(255);
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS source_entity_id VARCHAR(128);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Schema repair failed for chat_conversations';
    END $$;
    """,
    # 7. Chat Conversations Constraint
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_tenant_channel_user_key') THEN
             ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_tenant_channel_user_key UNIQUE (tenant_id, channel, external_user_id);
        END IF;
    EXCEPTION WHEN OTHERS THEN
         RAISE NOTICE 'Could not constraint unique chat_conversations';
    END $$;
    """,
    # 8. Chat Media
    """
    CREATE TABLE IF NOT EXISTS chat_media (
        id UUID PRIMARY KEY,
        tenant_id INTEGER, 
        channel VARCHAR(32) NOT NULL,
        provider_media_id VARCHAR(128),
        media_type VARCHAR(32) NOT NULL,
        mime_type VARCHAR(64),
        file_name VARCHAR(255),
        file_size INTEGER,
        storage_url TEXT NOT NULL,
        preview_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    # 9. Chat Messages
    """
    CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        tenant_id INTEGER, 
        conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL,
        message_type VARCHAR(32) NOT NULL DEFAULT 'text',
        content TEXT,
        media_id UUID REFERENCES chat_media(id),
        human_override BOOLEAN NOT NULL DEFAULT false,
        sent_by_user_id TEXT, 
        sent_from VARCHAR(64),
        sent_context VARCHAR(64),
        ycloud_message_id VARCHAR(128),
        provider_status VARCHAR(32),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        correlation_id TEXT,
        from_number VARCHAR(128),
        meta JSONB DEFAULT '{}',
        channel_source VARCHAR(32) DEFAULT 'whatsapp',
        is_shadow_indexed BOOLEAN DEFAULT FALSE
    );
    """,
    # 9b. Chat Messages Repair (Comprehensive Repair to avoid missing columns and fix legacy ID type)
    """
    DO $$
    BEGIN
        -- If ID is integer (legacy), we must drop it and recreate correctly
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'id') != 'uuid' THEN
            DROP TABLE IF EXISTS chat_messages CASCADE;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not check/drop chat_messages';
    END $$;
    """,
    # Re-create if dropped (Duplicate of step 9 basically, but safe)
    """
    CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        tenant_id INTEGER, 
        conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL,
        message_type VARCHAR(32) NOT NULL DEFAULT 'text',
        content TEXT,
        media_id UUID REFERENCES chat_media(id),
        human_override BOOLEAN NOT NULL DEFAULT false,
        sent_by_user_id TEXT, 
        sent_from VARCHAR(64),
        sent_context VARCHAR(64),
        ycloud_message_id VARCHAR(128),
        provider_status VARCHAR(32),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        correlation_id TEXT,
        from_number VARCHAR(128),
        meta JSONB DEFAULT '{}',
        channel_source VARCHAR(32) DEFAULT 'whatsapp',
        is_shadow_indexed BOOLEAN DEFAULT FALSE
    );
    """,
    # Ensure columns in case table existed but was missing those
    """
    DO $$
    BEGIN
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS correlation_id TEXT;
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS from_number VARCHAR(128);
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(32) DEFAULT 'text';
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_id UUID;
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel_source VARCHAR(32) DEFAULT 'whatsapp';
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_shadow_indexed BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Schema repair failed for chat_messages';
    END $$;
    """,
    # 10. System Events (For Console View)
    """
    CREATE TABLE IF NOT EXISTS system_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        event_type VARCHAR(64) NOT NULL, 
        severity VARCHAR(16) DEFAULT 'info',
        message TEXT,
        payload JSONB,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
    # 10b. System Events Repair (UUID Migration)
    """
    DO $$
    BEGIN
        -- Schema Drift: If 'id' is BIGINT/INTEGER (Legacy), we must drop and recreate.
        -- This is a destructive operation allowed by Protocol Omega during maintenance window.
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'system_events' AND column_name = 'id' AND data_type IN ('bigint', 'integer')
        ) THEN
            DROP TABLE system_events CASCADE;
        END IF;

        -- Columns Check (Standard Repair)
        ALTER TABLE system_events ADD COLUMN IF NOT EXISTS severity VARCHAR(16) DEFAULT 'info';
        ALTER TABLE system_events ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE system_events ADD COLUMN IF NOT EXISTS payload JSONB;
        ALTER TABLE system_events ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Schema repair failed for system_events';
    END $$;
    """,
    # 10c. Tools Management (Nexus v3.1)
    """
    CREATE TABLE IF NOT EXISTS tools (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        service_url TEXT,
        config JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, name)
    );
    """,
    # 11. Indexes
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages (conversation_id, created_at);",
    "CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant ON chat_conversations (tenant_id, updated_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_media ON chat_messages (media_id);",
    
    # 12. Advanced Features Columns
    """
    DO $$
    BEGIN
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS total_tokens_used BIGINT DEFAULT 0;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS total_tool_calls BIGINT DEFAULT 0;
    END $$;
    """,
    
    # 13. Update Prompt
    """
    UPDATE tenants 
    SET system_prompt_template = 'Eres el asistente virtual de {STORE_NAME}.

REGLAS CRÍTICAS DE RESPUESTA:
1. SALIDA: Responde SIEMPRE con el formato JSON de OrchestratorResponse (una lista de objetos "messages").
2. ESTILO: Tus respuestas deben ser naturales y amigables. El contenido de los mensajes NO debe parecer datos crudos.
3. FORMATO DE LINKS: NUNCA uses formato markdown [texto](url). Escribe la URL completa y limpia en su propia línea nueva.
4. SECUENCIA DE BURBUJAS (8 pasos para productos):
   - Burbuja 1: Introducción amigable (ej: "Saluda si te han saludado, luego di Te muestro opciones de bolsos disponibles...").
   - Burbuja 2: SOLO la imageUrl del producto 1.
   - Burbuja 3: Nombre, precio, VARIANTES (Colores/Talles resumidos en misma línea). Luego un salto de línea y la URL del producto.
   - Burbuja 4: SOLO la imageUrl del producto 2.
   - Burbuja 5: DESCRIPCIÓN (breve y fiel). Luego un salto de línea. Nombre, precio, VARIANTES. Luego URL producto.
   - Burbuja 6: SOLO la imageUrl del producto 3 (si hay).
   - Burbuja 7: DESCRIPCIÓN (breve y fiel). Luego un salto de línea. Nombre, precio, VARIANTES. Luego URL producto.
   - Burbuja 8: CTA Final con la URL general ({STORE_URL}) en una línea nueva o invitación a Fitting si son puntas.
5. FITTING: Si el usuario pregunta por "zapatillas de punta" por primera vez, recomienda SIEMPRE un fitting en la Burbuja 8.
6. NO inventes enlaces. Usa los devueltos por las tools. NUNCA inventes descripción, usa la provista.
7. USO DE CATALOGO: Tu variable {STORE_CATALOG_KNOWLEDGE} contiene las categorías y marcas reales.
   - Antes de llamar a `search_specific_products`, REVISA el catálogo.
   - Si el usuario pide "bolsos", mira que marcas de bolsos hay y busca por marca o categoría exacta (ej: `search_specific_products("Bolsos")`).
   - Evita `browse_general_storefront` si hay un término de búsqueda claro.
GATE: Usa `search_specific_products` SIEMPRE que pidan algo específico.
CONTEXTO DE LA TIENDA:
{STORE_DESCRIPTION}
CATALOGO:
{STORE_CATALOG_KNOWLEDGE}'
    WHERE system_prompt_template IS NULL;
    """,
    # 14. Business Assets (Nexus Engine v3.2 - Phase 2)
    """
    CREATE TABLE IF NOT EXISTS business_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR(255) NOT NULL,
        asset_type VARCHAR(50) NOT NULL,
        content JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_business_assets_tenant ON business_assets (tenant_id, is_active);
    """,
    # 14b. Business Assets Repair (Schema Drift Prevention)
    """
    DO $$
    BEGIN
        ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);
        ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50);
        ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS content JSONB;
        ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
        ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE business_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END $$;
    """,
    # 15. Repair Users Schema for UX Phase (Profile Support)
    """
    DO $$
    BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
    END $$;
    """,
    # 15. Multi-Channel Support (Nexus v4.0 - Chatwoot Phase 1)
    """
    DO $$
    BEGIN
        -- chat_conversations evolution
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS channel_source VARCHAR(32) DEFAULT 'whatsapp';
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS external_chatwoot_id INTEGER;
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS external_account_id INTEGER;

        -- customers evolution
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram_psid VARCHAR(128);
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS facebook_psid VARCHAR(128);

        -- Performance Indexes
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_instagram') THEN
            CREATE INDEX idx_customers_instagram ON customers (instagram_psid);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_facebook') THEN
            CREATE INDEX idx_customers_facebook ON customers (facebook_psid);
        END IF;

        -- Relaxation: phone_number is no longer mandatory for social customers
        ALTER TABLE customers ALTER COLUMN phone_number DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Schema evolution for Chatwoot Phase 1 failed';
    END $$;
    """,
    # 16. Structural Reinforcement (Nexus v4.2)
    """
    DO $$
    BEGIN
        -- Relieve constraints for social customers
        ALTER TABLE customers ALTER COLUMN phone_number DROP NOT NULL;
        ALTER TABLE customers ALTER COLUMN phone_number SET DEFAULT NULL;
        
        -- Add missing traceability to messages
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel_source VARCHAR(32) DEFAULT 'whatsapp';
        
        -- Ensure unique constraint on customers is tenant-aware and handles nulls correctly
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_instagram_psid_unique') THEN
            CREATE UNIQUE INDEX idx_customers_instagram_psid_unique ON customers (tenant_id, instagram_psid) WHERE instagram_psid IS NOT NULL;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Structural reinforcement failed';
    END $$;
    """,
    # 17. Tool Prompt Injection (Nexus v4.5)
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tools' AND column_name='prompt_injection') THEN
            ALTER TABLE tools ADD COLUMN prompt_injection TEXT DEFAULT '';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Tool Prompt Injection evolution failed';
    END $$;
    """,
    # 18. Agents Channels (Nexus v4.6)
    """
    DO $$
    BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS channels JSONB DEFAULT '["whatsapp", "instagram", "facebook"]';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add channels to agents';
    END $$;
    """,
    # 19. Fix Agents Table Schema Drift (Nexus v4.6.1)
    """
    DO $$
    BEGIN
        -- Detect if ID is UUID (broken state) and recreate as SERIAL
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'agents' AND column_name = 'id' AND data_type = 'uuid'
        ) THEN
            -- Protocol Omega: Destructive repair for non-live data in MVP
            DROP TABLE agents CASCADE;
            
            CREATE TABLE agents (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id),
                name TEXT NOT NULL,
                role TEXT DEFAULT 'sales',
                whatsapp_number TEXT,
                model_provider TEXT DEFAULT 'openai',
                model_version TEXT DEFAULT 'gpt-4o',
                temperature FLOAT DEFAULT 0.3,
                system_prompt_template TEXT NOT NULL,
                enabled_tools JSONB DEFAULT '[]',
                channels JSONB DEFAULT '["whatsapp", "instagram", "facebook"]',
                config JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT TRUE,
                template_type VARCHAR(50), 
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to repair agents table schema';
    END $$;
    """,
    # 20. Tool Response Guidance (Nexus v4.6.2)
    """
    DO $$
    BEGIN
        ALTER TABLE tools ADD COLUMN IF NOT EXISTS response_guide TEXT;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add response_guide to tools';
    END $$;
    """,
    # 21. Business Assets constraint repair (Protocol Omega)
    """
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_asset_type') THEN
            ALTER TABLE business_assets ADD CONSTRAINT unique_tenant_asset_type UNIQUE (tenant_id, asset_type);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add unique constraint to business_assets';
    END $$;
    """,
    # 22. Magic Onboarding State (Protocol Omega)
    """
    DO $$
    BEGIN
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add onboarding_status to tenants';
    END $$;
    """,
    # 23. Agent Knowledge Linking (Nexus v5.1)
    """
    DO $$
    BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS knowledge_sources JSONB DEFAULT '[]';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to add knowledge_sources to agents';
    END $$;
    """,
    # 24. Users & Auth (Sovereign Identity)
    """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        role VARCHAR(50) DEFAULT 'owner',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);
    """,
    # 24. RAG Documents (Private Knowledge Base)
    """
    CREATE TABLE IF NOT EXISTS rag_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        storage_url TEXT,
        status VARCHAR(32) DEFAULT 'pending', -- pending, processing, active, error
        meta JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_rag_documents_tenant ON rag_documents (tenant_id);
    """,
    # 25. Users Evolution (v5.1 Sovereign SaaS)
    """
    DO $$
    BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_verification_email_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'owner';
        ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Sovereign SaaS user migration failed';
    END $$;
    """,
    # 26. Cleanup: Ensure is_verified exists in repair logic too
    """
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    """,
    # 27. OAuth Providers (Credential Architecture v2)
    """
    CREATE TABLE IF NOT EXISTS oauth_providers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    # 28. Seed OAuth Providers (v6.2.24 Update)
    """
    INSERT INTO oauth_providers (name, display_name, description, created_at, updated_at) VALUES 
    ('openai', 'OpenAI', 'AI Model Provider', NOW(), NOW()),
    ('google', 'Google Gemini', 'AI Model Provider', NOW(), NOW()),
    ('meta', 'Meta (Facebook/Instagram)', 'Social Media Integration', NOW(), NOW()),
    ('whatsapp_cloud', 'WhatsApp Cloud API', 'Official WhatsApp Business API', NOW(), NOW()),
    ('tiendanube', 'TiendaNube', 'E-commerce Platform', NOW(), NOW()),
    ('ycloud', 'YCloud', 'WhatsApp BSP', NOW(), NOW())
    ON CONFLICT (name) DO NOTHING;
    """,
    # 29. Credential Types (Credential Architecture v2)
    """
    CREATE TABLE IF NOT EXISTS credential_types (
        id SERIAL PRIMARY KEY,
        provider_id INTEGER REFERENCES oauth_providers(id) ON DELETE CASCADE,
        internal_key VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        is_required BOOLEAN DEFAULT TRUE,
        field_type VARCHAR(50) DEFAULT 'text', -- text, password, textarea, file
        placeholder VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    """,
    # 30. Seed Credential Types (v6.2.24 Update - YCloud Webhook Fix Included)
    """
    DO $$
    DECLARE
        openai_id INT;
        ycloud_id INT;
        tn_id INT;
        meta_id INT;
        google_id INT;
    BEGIN
        SELECT id INTO openai_id FROM oauth_providers WHERE name = 'openai';
        SELECT id INTO ycloud_id FROM oauth_providers WHERE name = 'whatsapp_cloud';
        SELECT id INTO tn_id FROM oauth_providers WHERE name = 'tiendanube';
        SELECT id INTO meta_id FROM oauth_providers WHERE name = 'meta';
        SELECT id INTO google_id FROM oauth_providers WHERE name = 'google';

        -- OpenAI
        IF openai_id IS NOT NULL THEN
            INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder)
            VALUES (openai_id, 'OPENAI_API_KEY', 'OpenAI API Key', 'Main API Key for GPT Models', true, 'password', 'sk-...')
            ON CONFLICT (internal_key) DO NOTHING;
        END IF;

        -- Google
        IF google_id IS NOT NULL THEN
            INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder)
            VALUES (google_id, 'GOOGLE_API_KEY', 'Google Gemini API Key', 'API Key for Gemini Models', true, 'password', 'AIza...')
            ON CONFLICT (internal_key) DO NOTHING;
        END IF;

        -- TiendaNube
        IF tn_id IS NOT NULL THEN
            INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder)
            VALUES 
            (tn_id, 'TIENDANUBE_ACCESS_TOKEN', 'TiendaNube Access Token', 'OAuth Access Token', true, 'password', 'bearer_token'),
            (tn_id, 'TIENDANUBE_STORE_ID', 'TiendaNube Store ID', 'Unique identifier for the TiendaNube store', true, 'text', '123456')
            ON CONFLICT (internal_key) DO NOTHING;
        END IF;

        -- YCloud (WhatsApp)
        IF ycloud_id IS NOT NULL THEN
             INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder)
            VALUES 
            (ycloud_id, 'YCLOUD_API_KEY', 'YCloud API Key', 'Main API Key for YCloud Integration', true, 'password', 'e3ce...'),
            (ycloud_id, 'YCLOUD_WEBHOOK_SECRET', 'YCloud Webhook Secret', 'Secret for verifying incoming webhooks from YCloud', true, 'password', 'whsec_...')
            ON CONFLICT (internal_key) DO NOTHING;
        END IF;
        
        -- Meta (Generic)
        IF meta_id IS NOT NULL THEN
            INSERT INTO credential_types (provider_id, internal_key, display_name, description, is_required, field_type, placeholder)
            VALUES (meta_id, 'META_ACCESS_TOKEN', 'Meta Access Token (EAAG...)', 'Long-lived User/System Token', true, 'password', 'EAAG...')
            ON CONFLICT (internal_key) DO NOTHING;
        END IF;

    END $$;
    """,
    
    # 31. Channel Bindings Table (Multi-Tenant Architecture v7.0)
    """
    CREATE TABLE IF NOT EXISTS channel_bindings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        channel_id VARCHAR(100) NOT NULL,
        label VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (provider, channel_id)
    );

    CREATE INDEX IF NOT EXISTS idx_channel_lookup ON channel_bindings(provider, channel_id);

    -- Enable Row-Level Security
    ALTER TABLE channel_bindings ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'channel_bindings' AND policyname = 'tenant_isolation'
        ) THEN
            CREATE POLICY tenant_isolation ON channel_bindings
              USING (tenant_id = current_setting('app.current_tenant_id', true)::int);
        END IF;
    END $$;
    """,
    
    # 32. Auto-migrate existing channels (v7.0 - Only if empty)
    """
    INSERT INTO channel_bindings (tenant_id, provider, channel_id, label, created_at)
    SELECT 
        id as tenant_id,
        'ycloud' as provider,
        bot_phone_number as channel_id,
        'Legacy WhatsApp (' || bot_phone_number || ')' as label,
        NOW() as created_at
    FROM tenants
    WHERE bot_phone_number IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM channel_bindings)
    ON CONFLICT (provider, channel_id) DO NOTHING;
    """,
    
    # 33. Verify Agent FK Constraint (v7.0)
    """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'agents_tenant_id_fkey'
        ) THEN
            ALTER TABLE agents 
            ADD CONSTRAINT agents_tenant_id_fkey 
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;
    END $$;
    """,
    # 34. Agent Metadata Migration (Sovereign Metadata v7.1.0)
    """
    DO $$
    BEGIN
        -- Migrate store metadata to agents table
        UPDATE agents a
        SET metadata = (
            COALESCE(a.metadata, '{}'::jsonb) || 
            jsonb_build_object(
                'website_url', t.store_website,
                'business_description', t.store_description,
                'catalog_knowledge', t.store_catalog_knowledge
            )
        )
        FROM tenants t
        WHERE a.tenant_id = t.id
        AND (t.store_website IS NOT NULL OR t.store_description IS NOT NULL OR t.store_catalog_knowledge IS NOT NULL)
        -- Optimization: Only run once per agent version if possible, but safe here due to idempotent jsonb_build_object
        AND (a.metadata->>'website_url' IS NULL);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Migration 34 (Metadata) failed or already applied';
    END $$;
    """,
    # 35. Sync existing TiendaNube credentials to Vault (v7.1.0)
    """
    DO $$
    BEGIN
        -- Sync access_token from tenants to credentials table
        INSERT INTO credentials (tenant_id, category, name, user_label, value, scope, updated_at)
        SELECT 
            id as tenant_id,
            'tiendanube' as category,
            'TIENDANUBE_ACCESS_TOKEN' as name,
            'TiendaNube Access Token' as user_label,
            tiendanube_access_token as value,
            'tenant' as scope,
            NOW() as updated_at
        FROM tenants
        WHERE tiendanube_access_token IS NOT NULL
        ON CONFLICT (tenant_id, category, name) DO UPDATE 
        SET value = EXCLUDED.value, updated_at = NOW();

        -- Sync store_id
        INSERT INTO credentials (tenant_id, category, name, user_label, value, scope, updated_at)
        SELECT 
            id as tenant_id,
            'tiendanube' as category,
            'TIENDANUBE_STORE_ID' as name,
            'TiendaNube Store ID' as user_label,
            tiendanube_store_id as value,
            'tenant' as scope,
            NOW() as updated_at
        FROM tenants
        WHERE tiendanube_store_id IS NOT NULL
        ON CONFLICT (tenant_id, category, name) DO UPDATE 
        SET value = EXCLUDED.value, updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Migration 35 (TN Vault Sync) failed or already applied';
    END $$;
    """
    # 36. Fix Credentials Table Constraints (v7.1.1)
    """
    DO $$
    BEGIN
        -- 1. Drop overly restrictive or incorrectly named constraints
        ALTER TABLE credentials DROP CONSTRAINT IF EXISTS uq_credentials_name_tenant;
        DROP INDEX IF EXISTS idx_credentials_tenant_unique;
        DROP INDEX IF EXISTS idx_credentials_global_unique;
        DROP INDEX IF EXISTS idx_credentials_global_cat_unique;
        DROP INDEX IF EXISTS idx_credentials_tenant_cat_unique;
        DROP INDEX IF EXISTS idx_credentials_upsert_logic;

        -- 2. Protocol Omega: Clean duplicates to ensure index creation succeeds
        DELETE FROM credentials a USING credentials b 
        WHERE a.id_uuid < b.id_uuid 
        AND a.tenant_id IS NOT DISTINCT FROM b.tenant_id 
        AND a.category IS NOT DISTINCT FROM b.category 
        AND a.name IS NOT DISTINCT FROM b.name;

        -- 3. Create modern, category-aware unique index for ON CONFLICT (tenant_id, category, name)
        -- Using standard unique index because ON CONFLICT requires it.
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_credentials_upsert_logic') THEN
            CREATE UNIQUE INDEX idx_credentials_upsert_logic 
            ON credentials (tenant_id, category, name);
        END IF;

        -- 4. Global Scope Uniqueness (tenant_id IS NULL) - Fallback protection
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_credentials_global_cat_unique') THEN
            CREATE UNIQUE INDEX idx_credentials_global_cat_unique 
            ON credentials (category, name) WHERE tenant_id IS NULL;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Migration 36 (Fix Credentials Constraints) failed: %', SQLERRM;
    END $$;
    """,

    # 37. Global Templates (v7.2.1)
    """
    DO $$
    BEGIN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE;
        ALTER TABLE agents ALTER COLUMN tenant_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to evolve agents table for global templates';
    END $$;
    """,
    # 38. Universal ID Routing (v7.5.2)
    """
    DO $$
    BEGIN
        ALTER TABLE channel_bindings ADD COLUMN IF NOT EXISTS external_account_id VARCHAR(50);
        CREATE INDEX IF NOT EXISTS idx_channel_account_lookup ON channel_bindings(channel_id, external_account_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Migration 38 (Universal ID) failed: %', SQLERRM;
    END $$;
    """
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Flight Check (Nexus v3.2 Protocol) ---
    logger.info("system_startup_initiated", version="v3.2 Protocol Omega")
    
    # 1. Environment Audit
    env_status = {
        "OPENAI_API_KEY": bool(OPENAI_API_KEY),
        "POSTGRES_DSN": bool(POSTGRES_DSN),
        "REDIS_URL": bool(REDIS_URL),
        "TIENDANUBE_TOKEN": bool(GLOBAL_TN_ACCESS_TOKEN),
        "INTERNAL_SECRET": bool(INTERNAL_SECRET_KEY)
    }
    logger.info("environment_audit", **env_status)

    # Startup: Connect to DB and Hydrate
    try:
        # 2. Connectivity Check: Postgres
        if not POSTGRES_DSN:
             logger.error("missing_postgres_dsn")
        else:
             await db.connect() 
             logger.info("connectivity_check", service="postgres", status="connected")
             
        # 3. Connectivity Check: Redis
        try:
             await redis_client.ping()
             logger.info("connectivity_check", service="redis", status="connected")
        except Exception as r_err:
             logger.error("connectivity_check", service="redis", status="failed", error=str(r_err))

        # 4. Auto-Migration for EasyPanel (Schema Repair & Prep)
        logger.info("maintenance_robot_start", strategy="schema_surgeon")
        
        # Execute migration steps sequentially
        for i, step in enumerate(migration_steps):
            try:
                if step.strip():
                    # Protocol Omega: Use the new helper method for consistency
                    await db.execute(step)
            except Exception as step_err:
                # Log but verify severity. "Index already exists" is fine.
                logger.debug(f"migration_step_ignored", index=i, error=str(step_err))

        logger.info("maintenance_robot_complete", status="tables_verified")

        # 5. Supabase RAG Bootstrapper (Nexus v5.9 Self-Healing Protocol)
        # Non-blocking start: Allows the server to bind and respond instantly.
        # The background task will retry up to 10 times with 5s delays.
        logger.info("rag_bootstrapper_queued")
        asyncio.create_task(background_db_setup())

        # 6. Universal Schema Creation (SQLAlchemy)
        # CRITICAL: Must import all models to ensure they are registered in Base.metadata
        from app.models.base import Base
        from app.models.tenant import Tenant
        from app.models.chat import ChatConversation, ChatMessage, ChatMedia
        from app.models.customer import Customer # Fixes "Phantom Table" issue
        from app.models.agent import Agent # Nexus v3 Agent Support
        from app.models.auth import User # Sovereign Identity
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        # 6. Hydrate Data (SQLAlchemy session)
        async with AsyncSessionLocal() as session:
            try:
                await init_db(session)
                logger.info("data_hydration_complete")
            except Exception as hyd_err:
                logger.error("data_hydration_failed", error=str(hyd_err))
                # Don't crash, allow partial startup
            
        logger.info("system_startup_complete", port=8000)
        
    except Exception as e:
        logger.error("startup_critical_error", error=str(e), dsn_preview=POSTGRES_DSN[:15] if POSTGRES_DSN else "None")
        # Optimization: We let it start, but health checks will fail.
        if "Name or service not known" in str(e):
             print(f"CRITICAL DNS ERROR: Cannot resolve database host. Check your POSTGRES_DSN: {POSTGRES_DSN}")
             raise e
    
    yield
    
    # Migration: Ensure Users table has profile fields
    try:
        # Use the fixed helper method
        await db.execute("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
            ADD COLUMN IF NOT EXISTS last_verification_email_at TIMESTAMPTZ;
        """)
        await db.execute("ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE")
    except Exception as e:
        logger.warning(f"Migration profile fields check failed (ignoring for shutdown): {e}")

    # Shutdown
    await db.disconnect()
    await engine.dispose()
    logger.info("shutdown_complete")

# FastAPI App Initialization
app = FastAPI(
    title="Orchestrator Service",
    description="Central intelligence for Kilocode microservices.",
    version="1.1.0",
    lifespan=lifespan
)

# --- CORS Policy Restoration (Nexus v5.5) ---
# Hardcoded fallbacks as per mission requirements
default_origins = [
    "https://multiagents-frontend.yn8wow.easypanel.host",
    "http://localhost:3000",
    "http://localhost:5173"
]

# Load from ENV if available
env_origins = os.getenv("ALLOWED_ORIGINS", "")
if env_origins:
    extra_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    default_origins.extend(extra_origins)

# Deduplicate
final_origins = list(set(default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=final_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
from app.api import agents, templates

app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(platform_router) # Platform Router (God Mode)
app.add_middleware(RateLimitMiddleware)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc))
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
    )
    # Manually add CORS headers to exception response to avoid "CORS Error" masking the real 500
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# (CORS Configuration moved to top for startup priority)

# Root Endpoint for basic health checks (Traefik/EasyPanel)
@app.get("/")
async def root():
    return {"status": "ok", "service": "orchestrator", "version": "1.1.0"}

class ToolResponse(BaseModel):
    ok: bool
    data: Optional[Any] = None
    error: Optional[ToolError] = None
    meta: Optional[Dict[str, Any]] = None

class InboundMedia(BaseModel):
    type: str
    url: str
    mime_type: Optional[str] = None
    file_name: Optional[str] = None
    provider_id: Optional[str] = None

class InboundChatEvent(BaseModel):
    provider: str
    event_id: str
    provider_message_id: str
    from_number: str
    to_number: Optional[str] = None
    text: Optional[str] = None # made optional for pure media messages
    customer_name: Optional[str] = None
    event_type: str
    correlation_id: str
    media: Optional[List[InboundMedia]] = None

class OrchestratorMessage(BaseModel):
    part: Optional[int] = Field(None, description="The sequence number of this message.")
    total: Optional[int] = Field(None, description="The total number of messages.")
    text: Optional[str] = Field(None, description="The text content of this message burst.")
    imageUrl: Optional[str] = Field(None, description="The URL of the product image (images[0].src from tools), or null if no image is available.")

class OrchestratorResult(BaseModel):
    status: Literal["ok", "duplicate", "ignored", "error"]
    send: bool
    text: Optional[str] = None
    messages: List[OrchestratorMessage] = Field(default_factory=list)
    meta: Optional[Dict[str, Any]] = None


# (Middleware and app instance moved to top)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "orchestrator"}

# --- Include Admin Router ---
app.include_router(admin_router)
app.include_router(onboarding_router, prefix="/admin/onboarding")

# Metrics
SERVICE_NAME = "orchestrator_service"
REQUESTS = Counter("http_requests_total", "Total Request Count", ["service", "endpoint", "method", "status"])
LATENCY = Histogram("http_request_latency_seconds", "Request Latency", ["service", "endpoint"])
TOOL_CALLS = Counter("tool_calls_total", "Total Tool Calls", ["tool", "status"])

# --- Tools & Helpers ---
async def get_cached_tool(key: str):
    try:
        data = await redis_client.get(f"cache:tool:{key}")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error("cache_read_error", error=str(e))
    return None

async def set_cached_tool(key: str, data: dict, ttl: int = 300):
    try:
        await redis_client.setex(f"cache:tool:{key}", ttl, json.dumps(data))
    except Exception as e:
        logger.error("cache_write_error", error=str(e))

# --- Tools & Helpers ---
MCP_URL = "https://n8n-n8n.qvwxm2.easypanel.host/mcp/d36b3e5f-9756-447f-9a07-74d50543c7e8"

async def call_mcp_tool(tool_name: str, arguments: dict):
    """Bridge to call tools on n8n MCP server with stateful session and SSE support."""
    logger.info("mcp_handshake_start", tool=tool_name)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            }
            
            # 1. Initialize
            init_payload = {
                "jsonrpc": "2.0",
                "id": "init-" + str(uuid.uuid4())[:8],
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "Orchestrator-Bridge", "version": "1.0"}
                }
            }
            init_resp = await client.post(MCP_URL, json=init_payload, headers=headers)
            
            if init_resp.status_code != 200:
                return f"MCP Init Failed ({init_resp.status_code}): {init_resp.text}"
            
            # Capture Mcp-Session-Id
            session_id = init_resp.headers.get("Mcp-Session-Id")
            if not session_id:
                try:
                    result = init_resp.json().get("result", {})
                    session_id = result.get("meta", {}).get("sessionId") or result.get("sessionId")
                except: pass
            
            if session_id:
                logger.info("mcp_session_captured", session_id=session_id)
                client.headers.update({"Mcp-Session-Id": session_id})

            # 2. Notifications/initialized
            notif_payload = {
                "jsonrpc": "2.0",
                "method": "notifications/initialized"
            }
            await client.post(MCP_URL, json=notif_payload, headers=headers)

            # 3. Call Tool
            call_payload = {
                "jsonrpc": "2.0",
                "id": "call-" + str(uuid.uuid4())[:8],
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
            
            all_text = ""
            async with client.stream("POST", MCP_URL, json=call_payload, headers=headers) as resp:
                if resp.status_code != 200:
                    raw_text = await resp.aread()
                    return f"MCP Tool Call Error {resp.status_code}: {raw_text.decode()}"

                async for line in resp.aiter_lines():
                    if not line: continue
                    if line.startswith("data: "):
                        data_json = line[6:]
                        try:
                            msg = json.loads(data_json)
                            if msg.get("id") == call_payload["id"] or "result" in msg or "error" in msg:
                                if "result" in msg: return msg["result"]
                                if "error" in msg: return f"MCP Tool Error: {msg['error']}"
                        except: pass
                    all_text += line + "\n"

            if not all_text.strip():
                return "MCP Server returned an empty response."
            
            try:
                json_resp = json.loads(all_text)
                if "result" in json_resp: return json_resp["result"]
                return json_resp
            except:
                return all_text
                
    except Exception as e:
        logger.error("mcp_bridge_error", tool=tool_name, error=str(e))
        await log_db("error", "tool_execution_failed", f"MCP Tool {tool_name} failed: {str(e)}", {"tool": tool_name})
        return f"MCP Bridge Exception: {str(e)}"


def simplify_product(p):
    """Keep only essential fields for the LLM to save tokens."""
    if not isinstance(p, dict): return p
    
    # Simplify variants to just a summary of options if needed, or specific prices
    variants = p.get("variants") or []
    if not isinstance(variants, list): variants = []
    
    price = "0"
    promo_price = None
    variant_details = []
    
    if variants:
        v0 = variants[0] if isinstance(variants[0], dict) else {}
        price = v0.get("price", "0")
        promo_price = v0.get("promotional_price", None)
        
        # Summarize variants (e.g., "Color: Rojo, Azul")
        seen_options = set()
        for v in variants:
            if not isinstance(v, dict): continue
            v_values = v.get("values") or []
            if isinstance(v_values, list):
                for val in v_values:
                    if isinstance(val, dict):
                        val_str = val.get("es") or val.get("en") 
                        if val_str: seen_options.add(val_str)
        
        if seen_options:
            variant_details = list(seen_options)

    # Extract first image URL
    image_url = None
    images = p.get("images") or []
    if isinstance(images, list) and len(images) > 0:
        img0 = images[0]
        if isinstance(img0, dict):
            image_url = img0.get("src")

    # Extract and clean description (ROBUST)
    desc_obj = p.get("description")
    raw_desc = ""
    if isinstance(desc_obj, dict):
        raw_desc = desc_obj.get("es", "")
    elif isinstance(desc_obj, str):
        raw_desc = desc_obj
    else:
        # Fallback to 'descripción' field if exists
        raw_desc = p.get("descripción", "") or ""

    if not isinstance(raw_desc, str): raw_desc = ""

    # Remove simple HTML tags for token saving
    clean_desc = re.sub('<[^<]+?>', '', raw_desc)
    # Truncate if too long (e.g. 300 chars)
    if len(clean_desc) > 300:
        clean_desc = clean_desc[:297] + "..."

    return {
        "id": p.get("id"),
        "name": p.get("name", {}).get("es", "Sin nombre"),
        "price": price,
        "promotional_price": promo_price,
        "description": clean_desc, 
        "variants": ", ".join(variant_details), 
        "url": p.get("canonical_url"),
        "imageUrl": image_url
    }

async def call_tiendanube_api(endpoint: str, params: dict = None):
    # Retrieve current tenant credentials from ContextVar
    store_id = tenant_store_id.get()
    token = tenant_access_token.get()

    if not store_id or not token:
        # Debug: Check if vars are actually empty
        logger.error("tiendanube_config_missing", 
                     store_id=store_id, 
                     has_token=bool(token),
                     context_note="ContextVar might not have propagated to tool task")
        return "Error: Store ID or Token not configured for this tenant. Please check database configuration for this phone number."

    headers = {
        "Authentication": f"bearer {token}",
        "User-Agent": "n8n (santiago@atendo.agency)",
        "Content-Type": "application/json"
    }
    try:
        url = f"https://api.tiendanube.com/v1/{store_id}{endpoint}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                logger.error("tiendanube_api_error", status=response.status_code, text=response.text[:200])
                return f"Error HTTP {response.status_code}: {response.text}"
            
            data = response.json()
            
            # Auto-simplify if it's a list of products
            if isinstance(data, list) and "/products" in endpoint:
                return [simplify_product(p) for p in data]
                
            return data
    except Exception as e:
        logger.error("tiendanube_request_exception", error=str(e))
        await log_db("error", "external_api_error", f"TiendaNube API failed: {endpoint}", {"error": str(e)})
        return f"Request Error: {str(e)}"

@tool
async def search_specific_products(q: str):
    """SEARCH for specific products by name, category, or brand. REQUIRED for queries like 'medias', 'zapatillas', 'puntas', 'grishko'. Input 'q' is the keyword."""
    cache_key = f"productsq:{q}"
    cached = await get_cached_tool(cache_key)
    if cached: return cached
    result = await call_tiendanube_api("/products", {"q": q, "per_page": 3})
    if isinstance(result, (dict, list)): await set_cached_tool(cache_key, result, ttl=600)
    return result

@tool
async def search_by_category(category: str, keyword: str):
    """Search for products by category and keyword in Tienda Nube. Returns top 3 results simplified."""
    q = f"{category} {keyword}"
    cache_key = f"search_by_category:{category}:{keyword}"
    cached = await get_cached_tool(cache_key)
    if cached: return cached
    result = await call_tiendanube_api("/products", {"q": q, "per_page": 3})
    if isinstance(result, (dict, list)): await set_cached_tool(cache_key, result, ttl=600)
    return result

@tool
async def browse_general_storefront():
    """Browse the generic storefront (latest items). Use ONLY for vague requests like 'what do you have?' or 'show me catalogue'. DO NOT USE for specific items."""
    cache_key = "productsall"
    cached = await get_cached_tool(cache_key)
    if cached: return cached
    result = await call_tiendanube_api("/products", {"per_page": 3})
    if isinstance(result, (dict, list)): await set_cached_tool(cache_key, result, ttl=600)
    return result

@tool
async def cupones_list():
    """List active coupons and discounts from Tienda Nube via n8n MCP."""
    return await call_mcp_tool("cupones_list", {})

@tool
async def orders(q: str):
    """Search for order information directly in Tienda Nube API.
    Pass the order ID (without #) to retrieve status and details."""
    clean_q = q.replace("#", "").strip()
    # Using search parameter 'q' as seen in the successful n8n config
    return await call_tiendanube_api("/orders", {"q": clean_q})

@tool
async def sendemail(subject: str, text: str):
    """Send an email to support or customer via n8n MCP."""
    return await call_mcp_tool("sendemail", {"Subject": subject, "Text": text})

from app.core.rag import RAGCore # Nexus v5.93

@tool
async def search_knowledge_base(query: str, collection_filter: Optional[str] = None):
    """
    Search for information in the database. 
    Use 'query' for the question.
    Use 'collection_filter' ONLY if the user's question clearly pertains to one of the available topics listed in [VALID KNOWLEDGE COLLECTIONS]. 
    Otherwise, leave null to search all.
    """
    # Resolve Tenant
    tid = current_tenant_id.get()
    if not tid: return "Error: No tenant context."
    
    # Init RAG
    # Note: RAGCore expects str tenant_id
    rag = RAGCore(tenant_id=str(tid), provider="openai")
    
    # Build Filter
    rag_filter = {}
    if collection_filter:
        rag_filter["collection"] = collection_filter
        
    # Execute
    return rag.search(query, filter=rag_filter)

@tool
async def derivhumano(reason: str, contact_name: Optional[str] = None, contact_phone: Optional[str] = None, summary: Optional[str] = None, action_required: Optional[str] = None):
    """EQUIPO/HUMANO: Use this tool to derive the conversation to a human operator via email and lock the AI. 
    Inputs:
    - reason: The main reason for handoff.
    - contact_name: Name of the customer.
    - contact_phone: Phone of the customer.
    - summary: 1-3 lines summary of the conversation.
    - action_required: What should the human do?"""
    
    tid = current_tenant_id.get()
    cid = current_conversation_id.get()
    cphone = current_customer_phone.get()
    
    if not tid or not cid:
        return "Error: Context not initialized for handoff."

    # 1. Fetch Tenant Handoff Settings
    config = await db.pool.fetchrow("""
        SELECT c.*, t.store_name 
        FROM tenant_human_handoff_config c
        JOIN tenants t ON c.tenant_id = t.id
        WHERE c.tenant_id = $1
    """, tid)
    
    if not config or not config['enabled']:
        return "Error: Handoff is currently disabled or not configured for this tenant."
    
    target_email = config['destination_email']
    handoff_msg = config['handoff_message'] or "Te derivo con una persona del equipo para ayudarte mejor 😊"

    # 2. Build Email Content based on email_context flags
    ctx = config['email_context'] or {}
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except:
            ctx = {}
            
    wa_id = (cphone or contact_phone) if ctx.get('ctx-phone') else "Oculto"
    user_name = (contact_name or 'No especificado') if ctx.get('ctx-name') else "Oculto"
    wa_link = f"https://wa.me/{wa_id}" if wa_id != "Oculto" else "No disponible"
    
    history_section = ""
    if ctx.get('ctx-history'):
        history_section = f"\nRESUMEN RECIENTE:\n{summary or 'Sin resumen de historial'}\n"

    metadata_section = ""
    if ctx.get('ctx-id'):
        metadata_section = f"Conversation ID: {cid}\nTimestamp: {formatdate(localtime=True)}\n"

    subject = f"Derivación Humana: {reason} - {user_name}"
    body = f"""DETALLE DE DERIVACIÓN (EQUIPO {config['store_name'].upper()})

Motivo: {reason}
Cliente: {user_name}
Teléfono: {wa_id}
Link WhatsApp: {wa_link}
{history_section}
ACCIÓN REQUERIDA:
{action_required or 'Atención inmediata'}

{metadata_section}Tienda: {config['store_name']}
"""

    # 3. Send Email using Platform Global SMTP (User-Friendly - No SMTP config required)
    try:
        from app.core.email import EmailService
        from fastapi_mail import MessageSchema, MessageType
        
        target_email = str(config['destination_email']).strip() if config['destination_email'] else ""
        
        if not target_email:
            logger.warning("handoff_no_destination_email", tenant_id=tid)
            return "Error: No se configuró un email de destino para derivaciones."
        
        # Use Platform Global SMTP (same credentials as verification emails)
        dynamic_conf = await EmailService.get_connection_config(tenant_id=tid, mode="system")
        
        # Create professional HTML email
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 20px;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }}
                .header {{
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px;
                    text-align: center;
                    color: white;
                }}
                .content {{
                    padding: 30px;
                    line-height: 1.6;
                    color: #333;
                }}
                .footer {{
                    background: #f8f9fa;
                    padding: 15px;
                    text-align: center;
                    font-size: 12px;
                    color: #6c757d;
                    border-top: 1px solid #dee2e6;
                }}
                pre {{
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 4px;
                    border-left: 4px solid #667eea;
                    overflow-x: auto;
                    white-space: pre-wrap;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔔 Derivación Humana</h2>
                </div>
                <div class="content">
                    <pre>{body}</pre>
                </div>
                <div class="footer">
                    Enviado automáticamente por Nexus Platform<br>
                    © 2025 MultiAgents Platform
                </div>
            </div>
        </body>
        </html>
        """
        
        message = MessageSchema(
            subject=subject,
            recipients=[target_email],
            body=html_body,
            subtype=MessageType.html
        )
        
        from fastapi_mail import FastMail
        fm = FastMail(dynamic_conf)
        await fm.send_message(message)
        
        logger.info("handoff_email_sent_platform_smtp", 
                   to=target_email, 
                   server=dynamic_conf.MAIL_SERVER, 
                   from_email=dynamic_conf.MAIL_FROM)
            
    except Exception as e:
        logger.error("handoff_email_failed", error=str(e))
        await log_db("error", "handoff_email_failed", str(e), {"tid": tid, "cid": str(cid)})

    # 4. Lock Conversation (24h)
    await db.pool.execute("UPDATE chat_conversations SET human_override_until = NOW() + INTERVAL '24 hours' WHERE id = $1", cid)
    
    return handoff_msg

# --- Tactical Prompt Injections (Pointe Coach Textual Instructions) ---
tactical_injections = {
    "search_specific_products": """BÚSQUEDA INTELIGENTE: Si piden "Malla Negra", busca solo "Malla" (o "Leotardo") y filtra vos mismo si hay variantes en negro. NO busques "Malla Negra" directo.

REGLA DE MAPEO: Antes de usar esta tool, compará la palabra con el Diccionario de Sinónimos. (ej: "mallas" -> buscás `search_specific_products(q='Leotardos')`).

GATE: Usa `search_specific_products` SIEMPRE que pidan algo específico. VALIDATION FIRST: Antes de buscar, identificá si el usuario pide una categoría del Diccionario de Sinónimos.

RELEVANCIA ESTRICTA (CRÍTICO): Si el usuario pide una categoría específica (ej: "Medias"), está terminantemente PROHIBIDO mostrar productos de otra categoría. Solo mostrá lo que se pidió tras el mapeo.

DICCIONARIO OBLIGATORIO: Mapeá CUALQUIER sinónimo a su categoría base antes de llamar a la tool. Nunca busques por el término informal del usuario si existe traducción.""",
    
    "search_by_category": """Antes de ejecutar, verifica en el Diccionario de Sinónimos si la categoría solicitada tiene un mapeo (ej: 'mallas' → 'Leotardos').""",
    
    "browse_general_storefront": """USAR SIEMPRE para consultas vagas ("¿Qué tienen?", "Mostrame algo") o como último recurso. No repreguntar, mostrar productos.

REGLA DE FALLBACK (SMART RETRY): Si buscás algo específico con search_specific_products y la tool devuelve 0 resultados:
- CASO A (Categoría en Diccionario): Si buscaste por Categoría Base (ej: Leotardos) y no hay nada, decí: "En este momento no tengo stock de [Leotardos] por ahora". NO muestres zapatillas ni otros productos al azar.
- CASO B (Consulta Vaga): Solo si la consulta es vaga, podés usar `browse_general_storefront`.

PARCHE CRÍTICO — ANTI "RESPUESTA SIN TOOL": Si el usuario pide "¿qué tienen disponible?": siempre responder con productos reales del catálogo.""",
    
    "search_knowledge_base": """Consulta siempre la política de cambios de zapatillas usadas (está prohibido si están marcadas). Responde sobre políticas, envíos o talles generales. No uses esta tool para productos (usar search_specific_products).

REGLAS ESPECÍFICAS:
- Zapatillas usadas/marcadas: NO se cambian (política crítica).
- Consultas sobre: políticas de devolución, tiempos de envío, guías de talles, cuidado de productos.
- Si no hay info en RAG, admitir: "No tengo esa información, te derivo a un humano".""",
    
    "derivhumano": """Usá `derivhumano` inmediatamente si:
(A) El usuario pide hablar con alguien.
(B) Tiene un PROBLEMA REAL con un pago o pedido que la tool no resuelve (ej: demora excesiva, queja).
(C) Hace preguntas técnicas profundas.

FITTING (SOLO PUNTAS): Ofrecelo exclusivamente para zapatillas de punta. Si el usuario acepta, usá `derivhumano`.

DERIVACIÓN OBLIGATORIA: Está TERMINANTEMENTE PROHIBIDO decir que derivás a un humano o usar el mensaje de cierre de derivación si NO ejecutaste exitosamente la tool `derivhumano` en ese mismo turno. Si la derivación es necesaria, llamá a la tool primero.

PROHIBIDO derivar para un simple chequeo de estado de orden (para eso está la tool orders).""",
    
    "orders": """ESTADO DE PEDIDO (SIN DERIVAR): Si el usuario solo quiere saber "dónde está mi pedido", usá SIEMPRE la tool `orders`. No derivés a humano para esto.

Pide el ID numérico sin #. Si el usuario da el ID con #, quitar el # antes de buscar.""",
    
    "cupones_list": """Si el cliente duda por el precio, consulta cupones activos para incentivar el cierre. No ofrecer cupones automáticamente, solo si detectas objeción de precio.

Gatillos:
- Cliente dice: "está caro", "es mucho", "no me alcanza".
- Cliente pregunta por descuentos/promos.

PROHIBIDO inventar cupones que no existen en la tool response.""",
    
    "sendemail": """Usar junto a derivhumano cuando se necesita notificar al equipo por email. Esta tool complementa la derivación."""
}

# --- Response Extraction Guides (Pointe Coach Textual Instructions) ---
response_guides = {
    "search_specific_products": """OBJETIVO PRINCIPAL: Mostrar 3 OPCIONES si la tool devuelve suficientes resultados.
ESCASEZ: Si hay menos de 3 (1 o 2), mostrá solo los que hay. Decí la verdad. Prohibido inventar productos para llenar los 3 espacios.

ANTI-REPETICIÓN (ESTRICTO): Revisá el historial. Si el usuario pide "más" o insiste y la tool devuelve los mismos productos que ya mostraste, NO los repitas. Decí la verdad. Está prohibido volver a mandar una ficha de producto si ya se mandó en los últimos 2 turnos.

FORMATO DE PRESENTACIÓN (WHATSAPP - LIMPIO):
Secuencia OBLIGATORIA: Intro -> Prod 1 -> Prod 2 -> Prod 3 -> CTA.

Estructura del campo `text` para productos (TODO EN UNO):
[NOMBRE DEL PRODUCTO]
Precio: $[PRECIO NUMÉRICO]
Variantes: [LISTA DE VARIANTES]
[DESCRIPCIÓN: FIDEDIGNA PERO RESUMIDA A MÁXIMO 2 LÍNEAS. NO TE EXCEDAS.]
[URL SIN ADORNOS]

REGLA DE CALL TO ACTION (CIERRE OBLIGATORIO):
- CASO 1 (SOLO ZAPATILLAS DE PUNTA): Siempre ofrecer "Fitting". El mensaje DEBE ser: "Para las puntas es clave que te asesores para elegir la mejor punta que se adecue a tu pie 🩰 Te contactamos con una asesora (FITTER)?". (IMPORTANTE: Esto NO aplica para Media Punta ni otros productos).
- CASO 2 (MUCHOS PRODUCTOS - 3 o +): Ofrecer link a la web.
- CASO 3 (POCOS PRODUCTOS - 1 o 2 totales): NO digas "ver más opciones". Usá un cierre de servicio: "¿Te puedo ayudar con algo más?" """,
    
    "search_by_category": """Usa el mismo formato que search_specific_products. Máximo 3 productos por respuesta para evitar saturación.""",
    
    "browse_general_storefront": """Mismo formato que search_specific_products. Mostrar 3 opciones del catálogo general con imágenes, precios y variantes.

CTA Final: "Si querés ver más opciones, entrá a nuestra web: {store_website}".""",
    
    "search_knowledge_base": """Proporciona la respuesta técnica sobre el calce o la tabla de talles de forma concisa y profesional. NO inventes. Cita la fuente si es relevante (ej: "Según nuestra guía de tallas..."). Si es politica crítica, enfatizar con mayúsculas: "IMPORTANTE: Las zapatillas marcadas NO se cambian".""",
    
    "orders": """Sé ULTRA BREVE: informá el estado y listo. 

Formato: "Tu pedido [ID] está [ESTADO] y fue despachado por [CORREO]."

No des detalles innecesarios. CTA: "¿Te puedo ayudar con algo más?" """,
    
    "cupones_list": """Extrae el código del cupón y el porcentaje de descuento de forma muy visible.

Formato: "🎟️ Tengo un cupón para vos: **[CÓDIGO]** - [%] OFF en [CONDICIÓN]. Aplicalo al momento de pagar para activar el descuento." """,
    
    "derivhumano": """El mensaje de despedida tras derivar DEBE ser según el motivo:

(1) Para FITTING/PUNTAS: '➡Te derivamos con una asesora (FITTER), que esta capacitada para que encuentres la mejor punta que se adecue a TU PIE 🩰 en breve se contacta con vos.'

(2) Para PEDIDOS: 'Fijate que ya te contacto con mis compañeras para que te ayuden con tu orden #... y sepas exactamente el estado.'

(3) Para OTROS (ayuda general, quejas, pedido de humano): Usá un mensaje cálido y coherente con lo que pidió el usuario.""",
    
    "sendemail": """Confirma que se envió la notificación al equipo. "Listo, ya notifiqué al equipo. Te van a contactar por email o WhatsApp en las próximas horas." """
}

tools = [search_specific_products, search_by_category, browse_general_storefront, search_knowledge_base, cupones_list, orders, sendemail, derivhumano]

# Register tools for Code Reflection (Nexus v3)
from admin_routes import register_tools, SYSTEM_TOOL_INJECTIONS, SYSTEM_TOOL_RESPONSE_GUIDES, unified_message_delivery
register_tools(tools, tactical_injections, response_guides)

from langchain.output_parsers import PydanticOutputParser
from langchain_core.messages import HumanMessage, AIMessage

# --- Output Schema for Agent ---
class OrchestratorResponse(BaseModel):
    """The structured response from the orchestrator agent containing multiple messages."""
    messages: List[OrchestratorMessage] = Field(description="List of messages (parts) to send to the user, in order.")

# Initialize Parser
parser = PydanticOutputParser(pydantic_object=OrchestratorResponse)

# Agent Initialization
# --- Agent Factory (Dynamic per Tenant) ---
async def get_agent_executable(ctx: TenantContext):
    """
    Creates an AgentExecutor dynamically based on the Tenant's Context.
    STRICTLY uses the context for credentials and prompts.
    """
    logger.info("building_agent_for_tenant", tenant_id=ctx.id, store=ctx.store_name)
    
    # 1. Inject Context into ContextVars (Bridge to Tools)
    if ctx.tiendanube_creds:
        tenant_store_id.set(ctx.tiendanube_creds.store_id)
        tenant_access_token.set(ctx.tiendanube_creds.access_token.get_secret_value())
    else:
         logger.warning("agent_build_warning_no_creds", tenant_id=ctx.id)
    
    current_tenant_id.set(ctx.id)

    # 2. Construct System Prompt
    sys_template = ctx.system_prompt_template or "Eres un asistente virtual amable."
    
    # Inject variables
    sys_template = sys_template.replace("{STORE_NAME}", ctx.store_name)
    sys_template = sys_template.replace("{STORE_CATALOG_KNOWLEDGE}", ctx.store_catalog_knowledge or "Sin catálogo.")
    sys_template = sys_template.replace("{STORE_DESCRIPTION}", ctx.store_description or "")
    # Default URL if not in context? We should add it to TenantContext logic later if missing
    sys_template = sys_template.replace("{STORE_URL}", "#") 

    # Ensure format instructions are present
    if "messages" not in sys_template.lower() or "json" not in sys_template.lower():
        sys_template += "\n\nCRITICAL: You must answer in JSON format following this schema: " + parser.get_format_instructions()

    # 3. Handoff Policy injection (Simplified for brevity, expands logic from ctx.handoff_policy)
    # ... logic would be similar to before but reading from ctx.handoff_policy dict ...

    # 4. Construct Prompt Object
    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=sys_template),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]).partial(format_instructions=parser.get_format_instructions())

    # 5. Create Agent with Tenant Key
    api_key = ctx.openai_key.get_secret_value() if ctx.openai_key else OPENAI_API_KEY
    if not api_key:
        raise ValueError("OPENAI_API_KEY missing for tenant and global fallback")
        
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=api_key, 
        temperature=0, 
        max_tokens=2000
    )
    
    agent_def = create_openai_functions_agent(llm, tools, prompt)
    return AgentExecutor(agent=agent_def, tools=tools, verbose=True)

# Global fallback for health checks (optional)
# agent = ... (Removed global instantiation to force per-request dynamic loading)

# Helper for DB Logging
async def log_db(level: str, event_type: str, message: str, meta: dict = None):
    """Fire and forget log to system_events."""
    try:
        if db.pool:
            # Schema uses: severity, event_type, message, payload, occurred_at
            # We map 'level' -> 'severity' and 'meta' -> 'payload'
            await db.pool.execute(
                "INSERT INTO system_events (severity, event_type, message, payload, occurred_at) VALUES ($1, $2, $3, $4, NOW())",
                level, event_type, message, json.dumps(meta) if meta else "{}"
            )
    except Exception as e:
        # Fallback to stdout if DB fails
        print(f"DB_LOG_FAIL: {e}")

# Middleware
@app.middleware("http")
async def add_metrics_and_logs(request: Request, call_next):
    start_time = time.time()
    correlation_id = request.headers.get("X-Correlation-Id") or request.headers.get("traceparent")
    
    # Log Request Start (Verbose?) No, let's log completion only to reduce noise, 
    # or errors.
    
    response = await call_next(request)
    process_time = time.time() - start_time
    status_code = response.status_code
    
    REQUESTS.labels(service=SERVICE_NAME, endpoint=request.url.path, method=request.method, status=status_code).inc()
    LATENCY.labels(service=SERVICE_NAME, endpoint=request.url.path).observe(process_time)
    
    logger.bind(
        service=SERVICE_NAME, correlation_id=correlation_id, status_code=status_code,
        method=request.method, endpoint=request.url.path, latency_ms=round(process_time * 1000, 2)
    ).info("http_request_completed" if status_code < 400 else "http_request_failed")
    
    # DB Logging for Console
    # We filter out health checks to avoid spamming the DB
    if "/health" not in request.url.path and "/metrics" not in request.url.path:
        level = "info" if status_code < 400 else "error"
        evt_type = "http_request"
        # Background task for logging to not block response? 
        # For simplicity in this MVP, we await. It's fast (Postgres).
        await log_db(
            level, 
            evt_type, 
            f"{request.method} {request.url.path}", 
            {
                "status": status_code, 
                "latency_ms": round(process_time * 1000, 2),
                "correlation_id": correlation_id
            }
        )

    return response

# Endpoints
@app.get("/metrics")
def metrics(): return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/ready")
async def ready():
    try:
        if db.pool: await db.pool.fetchval("SELECT 1")
        await redis_client.ping()
    except Exception as e:
        logger.error("readiness_check_failed", error=str(e))
        raise HTTPException(status_code=503, detail="Dependencies unavailable")
    return {"status": "ok"}

@app.get("/health")
def health(): return {"status": "ok"}

# --- Meta Compliance Endpoints ---

@app.get("/api/v1/auth/meta/deauthorize")
async def meta_deauthorize(request: Request):
    """
    Handles Meta deauthorization callback.
    """
    logger.info("meta_deauthorization_received", params=str(request.query_params))
    # Logic to handle deauthorization (e.g., mark tenant as inactive or log)
    return {"status": "success", "message": "Deauthorization acknowledged"}

@app.post("/api/v1/auth/meta/delete-data")
async def meta_delete_data(request: Request):
    """
    Handles Meta user data deletion request.
    """
    try:
        body = await request.json()
        logger.info("meta_data_deletion_requested", body=body)
        # Protocol Omega: Ensure customer data is handled according to policy
        # For now, we return the mandatory confirmation payload.
        # Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
        confirmation_code = str(uuid.uuid4())
        return {
            "url": f"https://nexus-platform.com/compliance/deletion-status/{confirmation_code}",
            "confirmation_code": confirmation_code
        }
    except Exception as e:
        logger.error("meta_delete_data_failed", error=str(e))
        return {"status": "error", "message": str(e)}

# Startup and Shutdown are handled by lifespan context manager.

from app.api.deps import get_current_tenant_webhook
from app.schemas.tenant import TenantInternal

@app.post("/chat")
async def chat_endpoint(
    request: Request, 
    background_tasks: BackgroundTasks,
    x_internal_token: str = Header(None),
    tenant: TenantInternal = Depends(get_current_tenant_webhook),
    stream: bool = False # New stream parameter
):
    """
    Main Webhook Endpoint.
    1. Tenant Resolved via Dependency (Fail-Fast).
    2. Event is processed relative to that Tenant.
    """
    # 1. Verification (Internal Token) - Optional if using Webhook Secret
    if INTERNAL_SECRET_KEY:
         if x_internal_token != INTERNAL_SECRET_KEY:
             logger.warning("unauthorized_webhook_attempt", reason="invalid_internal_token")
             raise HTTPException(status_code=401, detail="Unauthorized: Invalid Internal Token")
         
    try:
        payload = await request.json()
    except:
        raise HTTPException(400, "Invalid JSON")
        
    # ... (Rest of deduplication logic) ...
    # Instead of "bot_phone_number = ...", we utilize 'tenant'.
    
    # 2. Protocol Omega: Resolve context from tenant
    tenant_id = tenant.id
    
    # Parse payload into a consistent event object
    # This handles the complexity of YCloud/Meta payloads and now Chatwoot universal signals
    try:
        if payload.get("provider") == "chatwoot":
            # Universal Signal from Gateway
            tid = payload.get("tenant_id")
            if tid is not None:
                try:
                    tid = int(tid)
                except:
                    pass
            # Parse Attachments
            media_list = []
            attachments = payload.get("attachments", [])
            if attachments:
                for att in attachments:
                    m_url = att.get("data_url")
                    m_type = att.get("file_type") # image, audio, video
                    if m_url:
                        media_list.append(MediaObject(
                            url=m_url,
                            provider_id=att.get("id"),
                            m_type=m_type,
                            mime=att.get("content_type"),
                            filename=f"{m_type}_{att.get('id')}"
                        ))

            event = SimpleEvent(
                from_num=payload.get("from_number"),
                text=payload.get("text") or payload.get("content"),
                msg_id=payload.get("event_id"),
                channel_source=payload.get("channel_source", "whatsapp"),
                external_cw_id=payload.get("external_chatwoot_id"),
                external_acc_id=payload.get("external_account_id"),
                tenant_id=tid,
                media=media_list,
                event_type=payload.get("event_type", "message")
            )
            
            # Map Chatwoot Message Type to Role
            # generic/incoming -> user
            # generic/outgoing -> assistant
            msg_type = payload.get("message_type") or "incoming"
            if msg_type == "outgoing":
                event.role = 'assistant'
            
            if payload.get("customer_name"):
                event.customer_name = payload.get("customer_name")
        else:
            # Legacy YCloud/Meta direct hit
            entry = payload.get("entry", [])[0]
            change = entry["changes"][0]["value"]
            msg_data = change.get("messages", [])[0]
            from_number = msg_data.get("from")
            text_body = msg_data.get("text", {}).get("body", "")
            message_id = msg_data.get("id")
            
            event = SimpleEvent(from_number, text_body, message_id)
    except Exception as e:
        logger.warning("payload_parse_failed", error=str(e))
        return OrchestratorResult(status="ignore", send=False, text="Unsupported payload structure")

    # message deduplication logic...
    # message deduplication logic...
    event_id = event.event_id
    if await redis_client.get(f"processed:{event_id}"):
        return OrchestratorResult(status="duplicate", send=False)
        
    await redis_client.set(f"processed:{event_id}", "1", ex=86400)
    
    # --- 0. Protocol Omega: Identity Link (Find or Create Customer) ---
    source = event.channel_source
    customer_id = None
    
    if source == 'instagram':
        customer_id = await db.pool.fetchval("SELECT id FROM customers WHERE tenant_id = $1 AND instagram_psid = $2", tenant_id, event.from_number)
        if not customer_id:
            customer_id = await db.pool.fetchval("INSERT INTO customers (id, tenant_id, instagram_psid, name) VALUES ($1, $2, $3, $4) RETURNING id", uuid.uuid4(), tenant_id, event.from_number, event.customer_name)
    elif source == 'facebook':
        customer_id = await db.pool.fetchval("SELECT id FROM customers WHERE tenant_id = $1 AND facebook_psid = $2", tenant_id, event.from_number)
        if not customer_id:
            customer_id = await db.pool.fetchval("INSERT INTO customers (id, tenant_id, facebook_psid, name) VALUES ($1, $2, $3, $4) RETURNING id", uuid.uuid4(), tenant_id, event.from_number, event.customer_name)
    else:
        # Default WhatsApp (Phone)
        customer_id = await db.pool.fetchval("SELECT id FROM customers WHERE tenant_id = $1 AND phone_number = $2", tenant_id, event.from_number)
        if not customer_id:
            customer_id = await db.pool.fetchval("INSERT INTO customers (id, tenant_id, phone_number, name) VALUES ($1, $2, $3, $4) RETURNING id", uuid.uuid4(), tenant_id, event.from_number, event.customer_name)

    # --- 1. Conversation & Lockout Management ---
    channel = event.channel_source # Use real channel source
    
    # Try to find existing conversation using tenant_id from Protocol Omega
    # Enhanced lookup: by PSID/Phone OR by Chatwoot ID OR by shared customer_id (v6.1 Omni-Grouping)
    conv = await db.pool.fetchrow("""
        SELECT id, tenant_id, status, human_override_until 
        FROM chat_conversations 
        WHERE tenant_id = $1 AND (
            (channel = $2 AND external_user_id = $3) OR
            (external_chatwoot_id = $4 AND $4 IS NOT NULL) OR
            (customer_id = $5 AND $5 IS NOT NULL)
        )
        LIMIT 1
    """, tenant_id, channel, event.from_number, event.external_chatwoot_id, customer_id)
    
    conv_id = None
    is_locked = False
    
    if conv:
        conv_id = conv['id']
        # Update metadata (Omnichannel Sync - Protocol v4.2.2)
        await db.pool.execute("""
            UPDATE chat_conversations 
            SET external_chatwoot_id = COALESCE($1, external_chatwoot_id), 
                external_account_id = COALESCE($2, external_account_id), 
                channel_source = $3, 
                customer_id = $4,
                updated_at = NOW()
            WHERE id = $5
        """, event.external_chatwoot_id, event.external_account_id, source, customer_id, conv_id)

        # Protocol Omega: Strict lockout check
        if conv['human_override_until'] and conv['human_override_until'] > datetime.now().astimezone():
            is_locked = True
    else:
        # Create new conversation using resolved tenant_id
        new_conv_id = str(uuid.uuid4())
        conv_id = await db.pool.fetchval("""
            INSERT INTO chat_conversations (
                id, tenant_id, customer_id, channel, channel_source, external_user_id, 
                external_chatwoot_id, external_account_id, display_name, status, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $4, $5, $6, $7, $8, 'open', NOW(), NOW()
            ) RETURNING id
        """, new_conv_id, tenant_id, customer_id, channel, event.from_number, event.external_chatwoot_id, 
           event.external_account_id, event.customer_name or event.from_number)

    # --- 2. Handle Echoes (Human Messages from App) ---
    is_echo = False
    # Standard WhatsApp echoes or Outgoing Chatwoot messages from real agents
    if event.event_type in ["whatsapp.message.echo", "whatsapp.smb.message.echoes", "message_echo"]:
         is_echo = True
    elif event.event_type == "chatwoot.message_created" and event.role == 'assistant':
         is_echo = True
    
    if is_echo:
         logger.info("human_echo_received", from_number=event.from_number, text_preview=event.text[:50] if event.text else "Media")
         
         # 1. Update Chat Conversation Lockout
         if conv_id:
             await db.pool.execute("""
                 UPDATE chat_conversations 
                 SET human_override_until = NOW() + INTERVAL '24 hours',
                     status = 'human_handling'
                 WHERE id = $1
             """, conv_id)
             
             # 2. Log message to history (marked as assistant/human_echo to show in UI but not trigger AI)
             # We use 'assistant' role so it appears on the right side (or 'system'?)
             # User wants to know "human handled". 
             # Let's use 'assistant' but maybe add metadata? For now standard 'assistant'.
             if event.text:
                 await db.pool.execute("""
                     INSERT INTO chat_messages (id, conversation_id, role, content, created_at)
                     VALUES ($1, $2, 'assistant', $3, NOW())
                 """, str(uuid.uuid4()), conv_id, event.text)

         return OrchestratorResult(status="ok", send=False, text="Echo processed, AI paused.")
    # We will assume if event_type is 'echo' or similar custom logic.
    if event.event_type == "whatsapp.message.echo": 
        is_echo = True
        
    if is_echo:
        # 2.1 Update Lockout
        lockout_time = datetime.now() + timedelta(hours=24)
        await db.pool.execute("""
            UPDATE chat_conversations 
            SET human_override_until = $1, status = 'human_override', updated_at = NOW(), last_message_at = NOW(), last_message_preview = $2
            WHERE id = $3
        """, lockout_time, event.text[:50], conv_id)
        
        # 2.2 Insert Message
        await db.pool.execute("""
            INSERT INTO chat_messages (
                id, tenant_id, conversation_id, role, content, 
                human_override, sent_from, sent_context, created_at, channel_source
            ) VALUES (
                $1, $2, $3, 'assistant', $4,
                TRUE, 'webhook', 'whatsapp_echo', NOW(), $5
            )
        """, str(uuid.uuid4()), tenant_id, conv_id, event.text, event.channel_source)
        
        return OrchestratorResult(status="ignored", send=False, text="Echo handled")
        
    # --- 3. Handle User Message (Inbound) ---
    
    # Handle Media if present
    media_id = None
    message_type = "text"
    if event.media and len(event.media) > 0:
        m = event.media[0] # Assuming single media per message for now
        message_type = m.type
        # Persist Media
        # Persist Media
        media_uuid = str(uuid.uuid4())
        media_id = await db.pool.fetchval("""
            INSERT INTO chat_media (
                id, tenant_id, channel, provider_media_id, media_type, 
                mime_type, file_name, storage_url, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, NOW()
            ) RETURNING id
        """, media_uuid, tenant_id, channel, m.provider_id, m.type, m.mime_type or "application/octet-stream", m.file_name, m.url)
    

        # Store User Message
        correlation_id = event.correlation_id or str(uuid.uuid4())
        content = event.text or "" # Can be empty if just image
        user_msg_id = uuid.uuid4()
        
        await db.pool.execute("""
            INSERT INTO chat_messages (
                id, tenant_id, conversation_id, role, content, 
                correlation_id, created_at, message_type, media_id, from_number, channel_source
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, NOW(), $7, $8, $9, $10
            )
        """, user_msg_id, tenant_id, conv_id, event.role, content, correlation_id, message_type, media_id, event.from_number, event.channel_source)

        # Nexus v5.32: Shadow RAG Ingestion (User Message)
        background_tasks.add_task(ShadowIndexer.process_message, str(user_msg_id), tenant_id)
        
        # Update Conversation Metadata
        preview_text = content[:50] if content else f"[{message_type}]"
        await db.pool.execute("""
            UPDATE chat_conversations 
            SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW()
            WHERE id = $2
        """, preview_text, conv_id)

    # CHECK LOCKOUT: If locked, Abort AI
    if is_locked:
        logger.info("ai_locked_by_human_override", conversation_id=str(conv_id))
        return OrchestratorResult(status="ignored", send=False, text="Conversation locked by human override")



    # --- 4. Invoke Remote Agent (Nexus v3) with Smart Buffering ---
    
    # 4.1. Debounce Logic
    buffer_key = f"buffer:{event.from_number}"
    pending_key = f"pending:{event.from_number}"
    
    if event.text:
        await redis_client.rpush(buffer_key, event.text)
        await redis_client.expire(buffer_key, 60)

    if await redis_client.get(pending_key):
        return OrchestratorResult(status="buffered", send=False, text="Aguarda...")

    await redis_client.setex(pending_key, 5, "active")
    
    if stream:
        # 4.2. Streaming Mode (Real-time UX)
        async def stream_orchestrator():
             # We skip buffering for direct streaming
             async for event in execute_agent_v3_logic(
                 event.from_number, tenant_id, conv_id, 
                 correlation_id, event.text, event.customer_name, 
                 event.channel_source
             ):
                 yield f"data: {json.dumps(event)}\n\n"
        
        return StreamingResponse(stream_orchestrator(), media_type="text/event-stream")

    # 4.3. Standard Mode (Background Processing)
    background_tasks.add_task(process_buffer_task, event.from_number, tenant_id, conv_id, correlation_id, event.customer_name, event.channel_source)
    
    return OrchestratorResult(status="ok", send=False, text="Message Received.", meta={"correlation_id": correlation_id})

async def classify_intent(message: str, history: List[Dict[str, str]], agents: List[Any], store_name: str, tenant_id: int) -> Optional[Any]:
    """
    Uses a fast LLM call to classify user intent and select the best Agent Specialist.
    Part of the Nexus v5 'Armada' Coordination logic.
    """
    if not agents: return None
    if len(agents) == 1: return agents[0]

    agent_options = "\n".join([f"- {a['name']} (ID: {a['id']}, Role: {a['role']}): {a['system_prompt_template'][:100]}..." for a in agents])
    
    prompt = f"""
Eres el ENRUTADOR MAESTRO de la tienda '{store_name}'. 
Tu tarea es decidir qué AGENTE ESPECIALISTA debe responder al siguiente mensaje del usuario.

AGENTES DISPONIBLES:
{agent_options}

MENSAJE DEL USUARIO:
{message}

HISTORIAL RECIENTE (Contexto):
{json.dumps(history[-3:]) if history else "Sin historial"}

REGLAS:
1. Responde ÚNICAMENTE con el ID del agente elegido.
2. Si la intención no es clara, elige al 'Supervisor General' o al 'Ventas Expert' por defecto.
3. Si el usuario pregunta por talles, elige al 'Especialista de Talles'.
4. Si el usuario está enojado o pide hablar con un humano, elige al 'Supervisor General'.
5. Si el usuario pregunta por su paquete o envío, elige al 'Gerente de Logística'.

ID DEL AGENTE ELEGIDO:"""

    try:
        # Sovereign Credentials: Fetch key from DB (Credential Architecture v2)
        openai_key = await get_tenant_credential_by_type(tenant_id, "OPENAI_API_KEY")
        
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=openai_key or OPENAI_API_KEY, temperature=0, max_tokens=10)
        resp = await llm.ainvoke(prompt)
        chosen_id = resp.content.strip()
        
        for a in agents:
            if str(a['id']) == chosen_id or a['name'].lower() in chosen_id.lower() or a['role'].lower() in chosen_id.lower():
                return a
        return agents[0] # Fallback
    except Exception as e:
        logger.error("intent_classification_failed", error=str(e))
        return agents[0]


def extract_response_from_agent_output(agent_output: str) -> str:
    """
    Extrae solo el campo 'response' del output del agente.
    Maneja múltiples formatos: JSON con thought/response/tool_use, o texto plano.
    
    Args:
        agent_output: Output del agente (puede ser JSON string o texto plano)
    
    Returns:
        Solo el texto de respuesta, sin metadata técnica
    """
    if not agent_output:
        return ""
    
    # Intentar parsear como JSON
    try:
        parsed = json.loads(agent_output.strip())
        if isinstance(parsed, dict):
            # Si tiene campo 'response', extraerlo
            if 'response' in parsed:
                return parsed['response']
            # Si no, devolver el JSON completo como string (fallback)
            return str(parsed)
    except (json.JSONDecodeError, ValueError):
        # No es JSON, devolver tal cual
        pass
    
    # Fallback: devolver el texto original
    return agent_output

async def process_buffer_task(from_num, t_id, c_id, corr_id, customer_name, ch_source):
    buffer_key = f"buffer:{from_num}"
    timer_key = f"timer:{from_num}"
    lock_key = f"active_task:{from_num}"
    
    logger.info(f"⏳ BUFFER: Starting process_buffer_task loop | identifier={from_num}")
    
    try:
        # Loop until buffer is empty
        while True:
            # Debounce: wait for 16s silence (matching whatsapp_service logic)
            # We check the TTL of the timer_key. If it's 0 or doesn't exist, the silence period is over.
            while True:
                await asyncio.sleep(2)
                ttl = await redis_client.ttl(timer_key)
                if ttl <= 0:
                    break
                logger.info(f"⏸️ BUFFER: Waiting for silence... | ttl={ttl}s | identifier={from_num}")
            
            messages_raw = await redis_client.lrange(buffer_key, 0, -1)
            if not messages_raw:
                logger.info(f"📭 BUFFER: No more messages | identifier={from_num} | releasing_lock")
                break
                
            # Consume the messages we just read
            await redis_client.delete(buffer_key)
            
            # Fix: messages_raw already contains strings because of decode_responses=True in db.py
            combined_text = "\n".join([m if isinstance(m, str) else m.decode('utf-8') for m in messages_raw])
            logger.info(f"📥 BUFFER: Consuming batch | identifier={from_num} | count={len(messages_raw)} | text_length={len(combined_text)}")
            
            # Execute agent (Synchronous sink to ensure one task at a time per user)
            async for _ in execute_agent_v3_logic(from_num, t_id, c_id, corr_id, combined_text, customer_name, ch_source):
                pass 
                
    except Exception as e:
        logger.error("buffer_processing_failed", error=str(e), identifier=from_num)
    finally:
        # Always release the lock
        await redis_client.delete(lock_key)
        await redis_client.delete(timer_key)
        logger.info(f"🔓 LOCK: Released | identifier={from_num}")

async def execute_agent_v3_logic(from_number, tenant_id, conv_id, correlation_id, content, customer_name, channel_source='whatsapp'):
    """
    Handles the actual long-running agent execution and response delivery.
    """
    try:
        # 1. Fetch Tenant Context
        tenant_row = await db.pool.fetchrow("SELECT * FROM tenants WHERE id = $1", tenant_id)
        if not tenant_row:
            logger.error("tenant_not_found_on_execution", tenant_id=tenant_id)
            return

        # 1.5 Enforce 24h Policy (Hybrid Brain v5.34)
        # Check if conversation is within 24h window
        conv_status_row = await db.pool.fetchrow("""
             SELECT last_message_at, status FROM chat_conversations WHERE id = $1
        """, conv_id)
        
        if conv_status_row:
             last_msg_at = conv_status_row['last_message_at']
             # If last_msg_at is None, assume open (newly created) or closed? Assume open for safety if new.
             if last_msg_at:
                 # Check delta
                 # Ensure timezone awareness if needed, assuming naive UTC or same TZ
                 if (datetime.utcnow() - last_msg_at).total_seconds() > 24 * 3600:
                     logger.warning("agent_execution_blocked_24h_policy", conv_id=str(conv_id))
                     yield {"type": "error", "content": "SESSION_CLOSED_24H_POLICY"}
                     
                     # Trigger Re-engagement Suggestion (Optional Auto-Template)
                     # For now, we just stop.
                     return

        # 2. Fetch History for Context (Unificado Omnicanal - Protocolo Nexus v4.2.2)
        history_rows = await db.pool.fetch("""
            SELECT m.role, m.content, c.channel_source 
            FROM chat_messages m
            JOIN chat_conversations c ON m.conversation_id = c.id
            WHERE c.customer_id = (SELECT customer_id FROM chat_conversations WHERE id = $1)
            ORDER BY m.created_at ASC LIMIT 20
        """, conv_id)

        remote_history = []
        for h in history_rows:
             role = h['role']
             content_h = h['content'] or ""
             ch_s = h['channel_source'] or "whatsapp"
             
             # Format history to tell the agent the source if it helps context
             if role == 'user':
                  # Prefix with [CHANNEL] so agent knows where the user said this
                  remote_history.append({"role": "user", "content": f"[{ch_s.upper()}] {content_h}"})
             else:
                  remote_history.append({"role": role, "content": content_h})

        # 2b. Fetch Active Agent (Nexus v3) with Intent Routing
        agents = await db.pool.fetch("""
            SELECT * FROM agents 
            WHERE tenant_id = $1 AND is_active = TRUE 
            ORDER BY updated_at DESC
        """, tenant_id)
        
        agent_row = None
        
        if agents:
            # Protocol Omega: Intent-Based Routing (The "Armada" Coordinator)
            agent_row = await classify_intent(content, remote_history, agents, tenant_row['store_name'], tenant_id)
            if agent_row:
                 logger.info("agent_routed_by_intent", chosen_agent=agent_row['name'], role=agent_row['role'])
            else:
                 agent_row = agents[0]

        # 3. Construct System Prompt & Config
        if agent_row:
            # Prio 1: Agent Config
            raw_prompt = agent_row['system_prompt_template']
            enabled_tools = json.loads(agent_row['enabled_tools']) if agent_row['enabled_tools'] else []
            ks_raw = agent_row.get('knowledge_sources')
            if ks_raw:
                if isinstance(ks_raw, str):
                    try:
                        knowledge_sources = json.loads(ks_raw)
                        if not isinstance(knowledge_sources, list):
                             knowledge_sources = [ks_raw]
                    except:
                        knowledge_sources = [ks_raw]
                else:
                    knowledge_sources = ks_raw
            else:
                knowledge_sources = []
            model_config = {
                "provider": agent_row['model_provider'],
                "name": agent_row['model_version'], # Mapping Fix: Agent Service expects 'name'
                "config": json.loads(agent_row['config']) if agent_row['config'] else {}
            }
            temp_value = agent_row['temperature'] # Extract to root level

            # Nexus v5.27: Extract wizard overrides for Polymorphism
            wizard_overrides = {}
            if agent_row['config']:
                try:
                    conf = json.loads(agent_row['config'])
                    # We map specific wizard keys that the templates expect
                    # agent_templates.py expects: tone, business_rules, synonym_dictionary
                    wizard_overrides['tone'] = conf.get('agent_tone')
                    wizard_overrides['business_rules'] = conf.get('business_rules')
                    wizard_overrides['synonym_dictionary'] = conf.get('synonym_dictionary')
                except: pass
        else:
            # Prio 2: Tenant Config (Legacy / Fallback)
            raw_prompt = tenant_row.get("system_prompt_template") or GLOBAL_SYSTEM_PROMPT or "Eres un asistente virtual amable."
            enabled_tools = ["search_specific_products"] # Default set
            knowledge_sources = []
            model_config = {"provider": "openai", "name": "gpt-4o"}
            temp_value = 0.3 # Safe fallback


        # 🔍 Nexus v7.2: Polymorphic Context Priority
        # We prioritize Wizard (agent_row.config) over Tenant (tenant_row) for business context
        agent_conf_json = json.loads(agent_row['config']) if agent_row and agent_row['config'] else {}
        
        display_name = agent_conf_json.get('agent_name') or tenant_row['store_name']
        display_description = agent_conf_json.get('store_description') or tenant_row['store_description'] or ""
        display_catalog = agent_conf_json.get('catalog_knowledge') or tenant_row['store_catalog_knowledge'] or "Sin catálogo."
        display_website = agent_conf_json.get('store_website') or tenant_row['store_website'] or ""
        display_address = agent_conf_json.get('store_address') or tenant_row.get('store_location') or ""
        display_shipping = agent_conf_json.get('shipping_partners') or "nuestros partners logísticos"
        shadow_enabled = agent_conf_json.get('shadow_rag_enabled', False)

        # Variable Injection (using prioritized context)
        sys_template = raw_prompt
        sys_template = sys_template.replace("{STORE_NAME}", display_name)
        sys_template = sys_template.replace("{STORE_CATALOG_KNOWLEDGE}", display_catalog)
        sys_template = sys_template.replace("{STORE_DESCRIPTION}", display_description)
        sys_template = sys_template.replace("{store_website}", display_website)
        sys_template = sys_template.replace("{store_address}", display_address)
        sys_template = sys_template.replace("{SHIPPING_PARTNERS}", display_shipping)
        
        # Gather Tool Instructions
        tool_instructions_list = []
        db_tools_rows = await db.pool.fetch("SELECT name, prompt_injection, response_guide FROM tools")
        db_tool_map = {r['name']: r for r in db_tools_rows}
        tenant_tool_config = json.loads(tenant_row['tool_config']) if tenant_row.get('tool_config') else {}

        for t_name in enabled_tools:
            tactical = tenant_tool_config.get(t_name, {}).get('tactical') or db_tool_map.get(t_name, {}).get('prompt_injection') or SYSTEM_TOOL_INJECTIONS.get(t_name)
            response_g = tenant_tool_config.get(t_name, {}).get('response_guide') or db_tool_map.get(t_name, {}).get('response_guide') or SYSTEM_TOOL_RESPONSE_GUIDES.get(t_name)
            if tactical or response_g:
                # Inject website into response guides if needed
                if response_g: response_g = response_g.replace("{store_website}", display_website)
                tool_instructions_list.append(f"[{t_name}]: TÁCTICA: {tactical or ''} RESPUESTA: {response_g or ''}")

        # Sovereign Credentials (Credential Architecture v2)
        openai_key = await get_tenant_credential_by_type(tenant_id, "OPENAI_API_KEY")
        tn_token = await get_tenant_credential_by_type(tenant_id, "TIENDANUBE_ACCESS_TOKEN")
        tn_store_id = str(tenant_row['tiendanube_store_id']) if tenant_row.get('tiendanube_store_id') else None
        
        # 🔍 Diagnostic Logging (v7.2.0)
        logger.info(f"🔑 TN Credentials | tid={tenant_id} | token={'***' + tn_token[-4:] if tn_token and len(tn_token) >= 4 else 'NULL'} | store_id={tn_store_id or 'NULL'}")

        # 4. Agent Request
        agent_request = {
            "tenant_id": tenant_id,
            "user_id": str(agent_row['user_id']) if agent_row and 'user_id' in agent_row else None,
            "message": content,
            "history": remote_history,
            "context": {"store_name": display_name, "system_prompt": sys_template, "current_channel": channel_source},
            "credentials": {
                "openai_api_key": openai_key or OPENAI_API_KEY, 
                "tiendanube_store_id": tn_store_id, 
                "tiendanube_access_token": tn_token,
                "tiendanube_service_url": TIENDANUBE_SERVICE_URL
            },
            "agent_config": {
                "tools": enabled_tools, 
                "tool_instructions": tool_instructions_list, 
                "knowledge_sources": knowledge_sources, 
                "model": model_config,
                "temperature": temp_value,
                "template_type": agent_row['template_type'] if agent_row else "sales",
                "wizard_overrides": wizard_overrides if agent_row else {},
                "shadow_rag_enabled": shadow_enabled  # PROPACACIÓN EXITOSA (v7.2)
            }
        }

        # 5. Call Agent Service (Streaming Session)
        full_text_accumulated = ""
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", f"{AGENT_SERVICE_URL}/v1/agent/execute", 
                json=agent_request, headers={"X-Internal-Secret": INTERNAL_SECRET_KEY}
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line: continue
                    chunk = json.loads(line)
                    if chunk.get("type") == "token":
                        full_text_accumulated += chunk.get("content", "")
                    yield chunk

        # 6. Post-Stream: Consolidation & Delivery
        if not full_text_accumulated: 
            logger.warning(f"⚠️ AGENT: No response generated | from={from_number} | tenant={tenant_id}")
            return
        
        logger.info(f"🤖 AGENT: Raw response received | from={from_number} | length={len(full_text_accumulated)} | preview={full_text_accumulated[:100]}...")

        # FIRST: Extract response from (potentially JSON) output
        clean_response_full = extract_response_from_agent_output(full_text_accumulated)
        
        # SECOND: Split by '|||' (Intentional AI breaks)
        initial_parts = clean_response_full.split("|||")
        
        # THIRD: Emergency Auto-Splitter (v6.2.11)
        # Further split long parts by double newlines or char limits to improve UI/Relay stability
        final_parts = []
        for p in [p.strip() for p in initial_parts if p.strip()]:
            if len(p) > 400 or "\n\n" in p:
                # Basic split by double newline
                subparts = [sp.strip() for sp in p.split("\n\n") if sp.strip()]
                for sp in subparts:
                    if len(sp) > 500: # Hard limit for sub-splitting
                        # Split by sentence or space
                        while len(sp) > 500:
                            cut = sp.rfind('. ', 0, 500)
                            if cut == -1: cut = sp.rfind(' ', 0, 500)
                            if cut == -1: cut = 500
                            final_parts.append(sp[:cut+1].strip())
                            sp = sp[cut+1:].strip()
                        if sp: final_parts.append(sp)
                    else:
                        final_parts.append(sp)
            else:
                final_parts.append(p)

        for idx, text_content in enumerate(final_parts):
            if "HUMAN_HANDOFF_REQUESTED:" in text_content:
                reason = text_content.split("HUMAN_HANDOFF_REQUESTED:")[1].strip()
                await trigger_human_handoff_v3(from_number, tenant_id, conv_id, reason, customer_name)
                continue
            
            clean_response = text_content # Already clean
            logger.info(f"✅ AGENT: Bubble prepared | from={from_number} | length={len(clean_response)} | preview={clean_response[:100]}...")

            # Persist
            agent_msg_id = str(uuid.uuid4())
            await db.pool.execute("""
                INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content, correlation_id, created_at, from_number, channel_source)
                VALUES ($1, $2, $3, 'assistant', $4, $5, NOW(), $6, (SELECT channel_source FROM chat_conversations WHERE id = $3))
            """, agent_msg_id, tenant_id, conv_id, clean_response, correlation_id, from_number)
            
            # Nexus v5.32: Shadow RAG Ingestion (Agent Message)
            asyncio.create_task(ShadowIndexer.process_message(agent_msg_id, tenant_id))
            
            # --- Real-Time Update for UI (Protocol Omega) ---
            redis_payload = {
                "event": "message",
                "data": {
                    "id": agent_msg_id,
                    "conversation_id": str(conv_id),
                    "role": "assistant",
                    "content": clean_response,
                    "from_number": from_number,
                    "created_at": datetime.now().isoformat()
                }
            }
            channel_redis = f"events:tenant:{tenant_id}:assets"
            try:
                await redis_client.publish(channel_redis, json.dumps(redis_payload))
            except Exception as e:
                logger.warning(f"⚠️ UI: Failed to publish agent message | error={str(e)}")

            # Unified Delivery Logic (Nexus v6.1 - Triangular Routing)
            logger.info(f"📤 CHATWOOT: Sending response | conv={conv_id} | channel={channel_source} | length={len(clean_response)}")
            try:
                # Spacing Fix: Delay between bubbles
                if idx > 0:
                     logger.info(f"⏳ SPACING: Waiting 4s before next bubble | from={from_number}")
                     await asyncio.sleep(4)

                await unified_message_delivery(
                    tenant_id=tenant_id,
                    conv_id=conv_id,
                    phone=from_number,
                    text=text_content,
                    channel=channel_source,
                    correlation_id=correlation_id
                )
                logger.info(f"✅ CHATWOOT: Response sent successfully | conv={conv_id}")
            except Exception as e:
                logger.error("agent_delivery_failed", error=str(e), conv_id=str(conv_id))
                # We don't raise here to allow other parts to be sent if splitting by |||

        # Track Usage
        await db.pool.execute("UPDATE tenants SET total_tool_calls = total_tool_calls + 1 WHERE id = $1", tenant_id)

    except Exception as e:
        logger.error("agent_execution_v3_logic_failed", error=str(e))
        yield {"type": "error", "content": str(e)}

async def trigger_human_handoff_v3(from_number, tenant_id, conv_id, reason, customer_name):
    """Refactored version of handoff trigger for background execution."""
    logger.info("triggering_human_handoff", from_number=from_number, reason=reason)
    lockout_date = datetime(2099, 12, 31)
    await db.pool.execute("""
        UPDATE chat_conversations SET human_override_until = $1, status = 'human_override'
        WHERE id = $2
    """, lockout_date, conv_id)
    
    await db.pool.execute("""
        INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content, created_at)
        VALUES ($1, $2, $3, 'system', $4, NOW())
    """, uuid.uuid4(), tenant_id, conv_id, f"Solicitud de derivación humana: {reason}")
    
    logger.info("notifying_admins_of_handoff", tenant_id=tenant_id, customer=customer_name)
    
    # Check for Gmail Handoff
    try:
        tenant_settings = await db.pool.fetchrow("""
             SELECT handoff_enabled, handoff_target_email, store_name FROM tenants WHERE id = $1
        """, tenant_id)
        
        if tenant_settings and tenant_settings['handoff_enabled'] and tenant_settings['handoff_target_email']:
             # Protocol Omega: Human Handoffs ALWAYS use Global Platform SMTP
             # This ensures internal notifications come from the official Nexus account.
             
             email_payload = {
                 "to_email": tenant_settings['handoff_target_email'],
                 "subject": f"🚨 Solicitud de Humano: {tenant_settings['store_name']}",
                 "text": f"El cliente {customer_name} ({from_number}) solicita atención humana.\nMotivo: {reason}\n\nIngresa al panel para responder: https://app.nexus-ai.com",
                 # Pass None to force the downstream service to use its global env vars
                 "smtp_host": None,
                 "smtp_port": None,
                 "smtp_user": None,
                 "smtp_password": None
             }
             
             # Call TiendaNube Service (Tool Holder) to send email
             tn_service_url = os.getenv("TIENDANUBE_SERVICE_URL", "http://tiendanube_service:8003")
             internal_token = os.getenv("INTERNAL_API_TOKEN", "")
             
             async with httpx.AsyncClient(timeout=10.0) as client:
                 await client.post(
                     f"{tn_service_url}/tools/sendemail", 
                     json=email_payload,
                     headers={"X-Internal-Secret": internal_token}
                 )
             logger.info("handoff_email_sent", email=tenant_settings['handoff_target_email'])
    except Exception as e:
        logger.error("handoff_email_failed", error=str(e))

# --- Repair: Add System Prompt + Agent Columns per "Agente Soberano" Spec ---
migration_steps.append("""
DO $$
BEGIN
    -- Tenants
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tenants' AND column_name='system_prompt_template') THEN
        ALTER TABLE tenants ADD COLUMN system_prompt_template TEXT;
    END IF;

    -- Agents (Schema Drift Prevention)
    -- Just in case table exists but lacks new V3 spec columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='agents') THEN
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'sales';
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS user_id UUID;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.3;
        ALTER TABLE agents ALTER COLUMN whatsapp_number DROP NOT NULL;
        ALTER TABLE agents ALTER COLUMN system_prompt_template SET NOT NULL;
    END IF;

    -- Customers (Ghost Table Fix)
    CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        phone_number TEXT,
        instagram_psid TEXT,
        facebook_psid TEXT,
        circle TEXT DEFAULT 'unknown',
        first_name TEXT,
        last_name TEXT,
        name TEXT,
        email TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, phone_number)
    );

    -- ENFORCE CONSTRAINTS (Schema Drift Repair)
    -- If table existed without PK or Unique, add them now.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') THEN
       -- Ensure ID is PK
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='customers' AND constraint_type='PRIMARY KEY') THEN
           ALTER TABLE customers ADD PRIMARY KEY (id);
       END IF;
       -- Ensure Unique (tenant_id, phone_number) for lookups
       IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='customers' AND constraint_name='uq_customers_tenant_phone') THEN
           -- Try to add, might fail if duplicates exist (User must clean data if so)
           BEGIN
               ALTER TABLE customers ADD CONSTRAINT uq_customers_tenant_phone UNIQUE (tenant_id, phone_number);
           EXCEPTION WHEN others THEN
               RAISE NOTICE 'Skipping Unique Constraint on customers due to duplicates';
           END;
       END IF;
       -- Identity v6.1: PSIDs
       ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram_psid TEXT;
       ALTER TABLE customers ADD COLUMN IF NOT EXISTS facebook_psid TEXT;
       ALTER TABLE customers ADD COLUMN IF NOT EXISTS circle TEXT DEFAULT 'unknown';
       ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name TEXT;
       ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name TEXT;
       -- Phone number shouldn't be NOT NULL since Social users might not have it yet
       ALTER TABLE customers ALTER COLUMN phone_number DROP NOT NULL;
    END IF;

    -- Identity Link (Repair Roto)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_conversations') THEN
         ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
    END IF;

    -- Media Support (Phase 8: Attachments)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_messages') THEN
         ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Tool Config (The "Custom Guides" Requirement)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenants') THEN
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tool_config JSONB DEFAULT '{}';
    END IF;

    -- Chat Conversations Provider (Hybrid Output)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_conversations') THEN
        ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS provider VARCHAR(32) DEFAULT 'chatwoot';
    END IF;

    -- RAG Multi-Tenancy (Nexus v5.10)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rag_documents') THEN
        ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS user_id UUID;
    END IF;

END $$;
""")

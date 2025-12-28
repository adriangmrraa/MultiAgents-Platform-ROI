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
import redis
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

# --- Imports ---
from app.core.tenant import TenantContext
from app.api.deps import get_current_tenant_webhook, get_current_tenant_header
from app.models.customer import Customer # Schema Drift Prevention

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

from db import db

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
WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://whatsapp_service:8002")
INTERNAL_SECRET_KEY = os.getenv("INTERNAL_API_TOKEN") or os.getenv("INTERNAL_SECRET_KEY")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "agente-js-secret-key-2024")

from app.core.config import settings

# Global Fallback Content (only used if DB has no specific tenant config)
GLOBAL_STORE_DESCRIPTION = os.getenv("GLOBAL_STORE_DESCRIPTION")
GLOBAL_CATALOG_KNOWLEDGE = os.getenv("GLOBAL_CATALOG_KNOWLEDGE")
GLOBAL_SYSTEM_PROMPT = os.getenv("GLOBAL_SYSTEM_PROMPT")

if not OPENAI_API_KEY:
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        print("CRITICAL ERROR: OPENAI_API_KEY not found.")

# Initialize Structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# Initialize Redis
redis_client = redis.from_url(REDIS_URL)

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
    def __init__(self, from_num, text, msg_id, channel_source='whatsapp', external_cw_id=None, external_acc_id=None, tenant_id=None, media=None):
        self.from_number = str(from_num) if from_num is not None else None
        self.text = str(text) if text is not None else ""
        self.event_id = str(msg_id) if msg_id is not None else None
        self.customer_name = from_num # Fallback
        self.event_type = "message"
        self.media = media or []
        self.correlation_id = str(uuid.uuid4())
        self.channel_source = channel_source
        self.external_chatwoot_id = external_cw_id
        self.external_account_id = external_acc_id
        self.external_chatwoot_id = external_cw_id
        self.external_account_id = external_acc_id
        self.tenant_id = tenant_id
        self.role = 'user' # Default

# FastAPI App
from contextlib import asynccontextmanager
from utils import encrypt_password, decrypt_password
from admin_routes import router as admin_router, sync_environment

from app.core.database import AsyncSessionLocal, engine
from app.core.init_data import init_db

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
        channel_source VARCHAR(32) DEFAULT 'whatsapp'
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
        channel_source VARCHAR(32) DEFAULT 'whatsapp'
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
             redis_client.ping()
             logger.info("connectivity_check", service="redis", status="connected")
        except Exception as r_err:
             logger.error("connectivity_check", service="redis", status="failed", error=str(r_err))

        # 4. Auto-Migration for EasyPanel (Schema Repair & Prep)
        logger.info("maintenance_robot_start", strategy="schema_surgeon")
        
        # Execute migration steps sequentially
        for i, step in enumerate(migration_steps):
            try:
                if step.strip():
                    await db.pool.execute(step)
            except Exception as step_err:
                # Log but verify severity. "Index already exists" is fine. "No unique constraint" is fatal later but maybe here we are fixing it.
                logger.debug(f"migration_step_ignored", index=i, error=str(step_err))

        logger.info("maintenance_robot_complete", status="tables_verified")

        # 5. Universal Schema Creation (SQLAlchemy)
        # CRITICAL: Must import all models to ensure they are registered in Base.metadata
        from app.models.base import Base
        from app.models.tenant import Tenant
        from app.models.chat import ChatConversation, ChatMessage, ChatMedia
        from app.models.customer import Customer # Fixes "Phantom Table" issue
        from app.models.agent import Agent # Nexus v3 Agent Support
        
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

# CORS Configuration - Dynamically loaded from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# Metrics
SERVICE_NAME = "orchestrator_service"
REQUESTS = Counter("http_requests_total", "Total Request Count", ["service", "endpoint", "method", "status"])
LATENCY = Histogram("http_request_latency_seconds", "Request Latency", ["service", "endpoint"])
TOOL_CALLS = Counter("tool_calls_total", "Total Tool Calls", ["tool", "status"])

# --- Tools & Helpers ---
def get_cached_tool(key: str):
    try:
        data = redis_client.get(f"cache:tool:{key}")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error("cache_read_error", error=str(e))
    return None

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

def get_cached_tool(key: str):
    try:
        data = redis_client.get(f"cache:tool:{key}")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error("cache_read_error", error=str(e))
    return None

def set_cached_tool(key: str, data: dict, ttl: int = 300):
    try:
        redis_client.setex(f"cache:tool:{key}", ttl, json.dumps(data))
    except Exception as e:
        logger.error("cache_write_error", error=str(e))

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
    cached = get_cached_tool(cache_key)
    if cached: return cached
    result = await call_tiendanube_api("/products", {"q": q, "per_page": 3})
    if isinstance(result, (dict, list)): set_cached_tool(cache_key, result, ttl=600)
    return result

@tool
async def search_by_category(category: str, keyword: str):
    """Search for products by category and keyword in Tienda Nube. Returns top 3 results simplified."""
    q = f"{category} {keyword}"
    cache_key = f"search_by_category:{category}:{keyword}"
    cached = get_cached_tool(cache_key)
    if cached: return cached
    result = await call_tiendanube_api("/products", {"q": q, "per_page": 3})
    if isinstance(result, (dict, list)): set_cached_tool(cache_key, result, ttl=600)
    return result

@tool
async def browse_general_storefront():
    """Browse the generic storefront (latest items). Use ONLY for vague requests like 'what do you have?' or 'show me catalogue'. DO NOT USE for specific items."""
    cache_key = "productsall"
    cached = get_cached_tool(cache_key)
    if cached: return cached
    result = await call_tiendanube_api("/products", {"per_page": 3})
    if isinstance(result, (dict, list)): set_cached_tool(cache_key, result, ttl=600)
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

    # 3. SMTP Send
    try:
        smtp_host = str(config['smtp_host']).strip().replace("http://", "").replace("https://", "") if config['smtp_host'] else ""
        smtp_user = str(config['smtp_username']).strip() if config['smtp_username'] else ""
        smtp_pass = decrypt_password(config['smtp_password_encrypted'])
        smtp_port = config['smtp_port']
        smtp_sec = str(config['smtp_security']).strip().upper() if config['smtp_security'] else "SSL"
        
        target_email = str(config['destination_email']).strip() if config['destination_email'] else ""

        if smtp_user and smtp_pass and smtp_host and target_email:
            msg = MIMEText(body)
            msg['Subject'] = subject
            msg['From'] = smtp_user
            msg['To'] = target_email
            msg['Date'] = formatdate(localtime=True)

            if smtp_sec == 'SSL':
                with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            elif smtp_sec == 'STARTTLS':
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            else: # NONE or fallback
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
            
            logger.info("handoff_email_sent_smtp", to=target_email, host=smtp_host, port=smtp_port, security=smtp_sec)
        else:
            await call_mcp_tool("sendemail", {"Subject": subject, "Text": body})
            logger.info("handoff_email_sent_mcp_fallback", to=target_email)
            
    except Exception as e:
        logger.error("handoff_email_failed", error=str(e))
        await log_db("error", "handoff_email_failed", str(e), {"tid": tid, "cid": str(cid)})

    # 4. Lock Conversation (24h)
    await db.pool.execute("UPDATE chat_conversations SET human_override_until = NOW() + INTERVAL '24 hours' WHERE id = $1", cid)
    
    return handoff_msg

# --- Tactical Prompt Injections (Omega Protocol Defaults) ---
    "search_specific_products": "TÁCTICA: Cuando busques productos, usa SIEMPRE el parámetro 'q' con el nombre del producto, categoría o marca exacta. Si el cliente pregunta de forma vaga, pide precisión antes de buscar.",
    "search_by_category": "TÁCTICA: Selecciona la categoría correcta del catálogo para el parámetro 'category'. Si no estás seguro, usa 'search_specific_products' en su lugar.",
    "browse_general_storefront": "TÁCTICA: Usa esta herramienta solo para dar una visión general. Si el cliente menciona un producto específico, detente y usa 'search_specific_products'.",
    "search_knowledge_base": "TÁCTICA: Usa esta herramienta para responder preguntas sobre políticas, envíos, talles generales o información de la marca que NO sea un producto específico.",
    "derivhumano": "TÁCTICA: Activa esta herramienta si detectas frustración extrema, si el cliente pide hablar con un humano explícitamente, o si hay un problema técnico que no puedes resolver.",
    "orders": "TÁCTICA: Para buscar órdenes, solicita al cliente el ID numérico sin el símbolo #. Informa el estado actual de forma clara."
}

# --- Response Extraction Guides (Omega Protocol Defaults) ---
response_guides = {
    "search_specific_products": "GUÍA DE RESPUESTA: Para cada producto, envía PRIMERO la imagen en una burbuja separada usando ![nombre](url) seguido de |||, luego nombre, precio y un detalle breve y fidedigno (máximo 15 palabras). Si no hay stock, indícalo.",
    "search_by_category": "GUÍA DE RESPUESTA: Resume las categorías encontradas y ofrece ver los productos destacados de cada una.",
    "browse_general_storefront": "GUÍA DE RESPUESTA: Envía la imagen del primer producto destacado con ![nombre](url) ||| y menciona las 3 novedades más llamativas con sus precios.",
    "search_knowledge_base": "GUÍA DE RESPUESTA: Proporciona la respuesta basada en el conocimiento de forma concisa y profesional.",
    "orders": "GUÍA DE RESPUESTA: Extrae el estado (Ej: 'Pagado', 'Enviado') y la fecha estimada de entrega si está disponible.",
    "cupones_list": "GUÍA DE RESPUESTA: Extrae el código del cupón y el porcentaje de descuento de forma muy visible.",
    "derivhumano": "GUÍA DE RESPUESTA: Confirma al usuario que un humano revisará el caso y que el chat quedará pausado por 24h."
}

tools = [search_specific_products, search_by_category, browse_general_storefront, cupones_list, orders, sendemail, derivhumano]

# Register tools for Code Reflection (Nexus v3)
from admin_routes import register_tools, SYSTEM_TOOL_INJECTIONS, SYSTEM_TOOL_RESPONSE_GUIDES
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
        redis_client.ping()
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

@app.post("/chat", response_model=OrchestratorResult)
async def chat_endpoint(
    request: Request, 
    background_tasks: BackgroundTasks,
    x_internal_token: str = Header(None),
    tenant: TenantInternal = Depends(get_current_tenant_webhook)
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
                media=media_list
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
    event_id = event.event_id
    if redis_client.get(f"processed:{event_id}"):
        return OrchestratorResult(status="duplicate", send=False)
        
    redis_client.set(f"processed:{event_id}", "1", ex=86400)
    
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
    # Enhanced lookup: by PSID/Phone OR by Chatwoot ID
    conv = await db.pool.fetchrow("""
        SELECT id, tenant_id, status, human_override_until 
        FROM chat_conversations 
        WHERE tenant_id = $1 AND (
            (channel = $2 AND external_user_id = $3) OR
            (external_chatwoot_id = $4 AND $4 IS NOT NULL)
        )
    """, tenant_id, channel, event.from_number, event.external_chatwoot_id)
    
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
    if event.event_type in ["whatsapp.message.echo", "whatsapp.smb.message.echoes", "message_echo"]:
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
    
    await db.pool.execute("""
        INSERT INTO chat_messages (
            id, tenant_id, conversation_id, role, content, 
            correlation_id, created_at, message_type, media_id, from_number, channel_source
        ) VALUES (
            $1, $2, $3, $4, $5,
            $6, NOW(), $7, $8, $9, $10
        )
    """, uuid.uuid4(), tenant_id, conv_id, event.role, content, correlation_id, message_type, media_id, event.from_number, event.channel_source)
    
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
        redis_client.rpush(buffer_key, event.text)
        redis_client.expire(buffer_key, 60)

    if redis_client.get(pending_key):
        return OrchestratorResult(status="buffered", send=False, text="Aguarda...")

    redis_client.setex(pending_key, 5, "active")
    
    async def process_buffer_task(from_num, t_id, c_id, corr_id, customer_name, ch_source):
        await asyncio.sleep(2)
        try:
            messages_raw = redis_client.lrange(buffer_key, 0, -1)
            redis_client.delete(buffer_key)
            redis_client.delete(pending_key)
            if not messages_raw: return
            combined_text = "\n".join([m.decode('utf-8') for m in messages_raw])
            await execute_agent_v3_logic(from_num, t_id, c_id, corr_id, combined_text, customer_name, ch_source)
        except Exception as e:
            logger.error("buffer_processing_failed", error=str(e))

    background_tasks.add_task(process_buffer_task, event.from_number, tenant_id, conv_id, correlation_id, event.customer_name, event.channel_source)
    
    return OrchestratorResult(status="ok", send=False, text="Debouncing...", meta={"correlation_id": correlation_id})

async def classify_intent(message: str, history: List[Dict[str, str]], agents: List[Any], store_name: str) -> Optional[Any]:
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
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0, max_tokens=10)
        resp = await llm.ainvoke(prompt)
        chosen_id = resp.content.strip()
        
        for a in agents:
            if str(a['id']) == chosen_id or a['name'].lower() in chosen_id.lower() or a['role'].lower() in chosen_id.lower():
                return a
        return agents[0] # Fallback
    except Exception as e:
        logger.error("intent_classification_failed", error=str(e))
        return agents[0]


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
            agent_row = await classify_intent(content, remote_history, agents, tenant_row['store_name'])
            if agent_row:
                 logger.info("agent_routed_by_intent", chosen_agent=agent_row['name'], role=agent_row['role'])
            else:
                 agent_row = agents[0]

        # 3. Construct System Prompt & Config
        if agent_row:
            # Prio 1: Agent Config
            raw_prompt = agent_row['system_prompt_template']
            enabled_tools = json.loads(agent_row['enabled_tools']) if agent_row['enabled_tools'] else []
            model_config = {
                "provider": agent_row['model_provider'],
                "version": agent_row['model_version'],
                "temperature": agent_row['temperature'],
                "config": json.loads(agent_row['config']) if agent_row['config'] else {}
            }
        else:
            # Prio 2: Tenant Config (Legacy / Fallback)
            raw_prompt = tenant_row.get("system_prompt_template") or GLOBAL_SYSTEM_PROMPT or "Eres un asistente virtual amable."
            enabled_tools = ["search_specific_products"] # Default set
            model_config = {"provider": "openai", "version": "gpt-4o"}

        # Variable Injection
        sys_template = raw_prompt
        sys_template = sys_template.replace("{STORE_NAME}", tenant_row['store_name'])
        sys_template = sys_template.replace("{STORE_CATALOG_KNOWLEDGE}", tenant_row['store_catalog_knowledge'] or "Sin catálogo.")
        sys_template = sys_template.replace("{STORE_DESCRIPTION}", tenant_row['store_description'] or "")
        
        # 3.5. Gather Tool Instructions (Tactical Protocol Injection)
        # We fetch instructions for tools enabled for THIS agent from BOTH System, DB and Tenant Config.
        tool_instructions_list = []
        db_tools_rows = await db.pool.fetch("SELECT name, prompt_injection, response_guide FROM tools")
        db_tool_map = {r['name']: r for r in db_tools_rows}
        
        # Prio 0: Tenant Specific Tool Config (Custom Guides UI)
        tenant_tool_config = {}
        if tenant_row.get('tool_config'):
             try:
                 tenant_tool_config = json.loads(tenant_row['tool_config']) if isinstance(tenant_row['tool_config'], str) else tenant_row['tool_config']
             except: pass

        for t_name in enabled_tools:
            tactical = ""
            response_g = ""
            
            # Prio 1/0: Tenant Configuration Override (Custom Guides UI)
            if t_name in tenant_tool_config:
                 tactical = tenant_tool_config[t_name].get('tactical') or tenant_tool_config[t_name].get('prompt_injection', "")
                 response_g = tenant_tool_config[t_name].get('response_guide')
            
            # Prio 2: DB Centralized tools table override
            if not tactical and t_name in db_tool_map:
                tactical = db_tool_map[t_name]['prompt_injection']
                # If we still don't have a response guide from tenant_config, try DB
                if not response_g:
                    response_g = db_tool_map[t_name].get('response_guide')
            
            # Prio 3: System Default (hardcoded in main.py)
            if not tactical and t_name in SYSTEM_TOOL_INJECTIONS:
                tactical = SYSTEM_TOOL_INJECTIONS[t_name]
            if not response_g and t_name in SYSTEM_TOOL_RESPONSE_GUIDES:
                response_g = SYSTEM_TOOL_RESPONSE_GUIDES[t_name]
                
            instr = f"[{t_name}]:"
            if tactical: instr += f" TÁCTICA: {tactical}"
            if response_g: instr += f" RESPUESTA/EXTRACCIÓN: {response_g}"
            
            if tactical or response_g:
                tool_instructions_list.append(instr)
        
        # Multichannel Context Injection
        if channel_source == 'instagram':
            sys_template += "\n\nResponde de forma breve y visual, estás en Instagram. Usa emojis."
            logger.info("agent_thinking_multichannel", channel="instagram", tone="brief_visual")
        elif channel_source == 'facebook':
            sys_template += "\n\nResponde de forma natural y cercana, estás en Facebook."
            logger.info("agent_thinking_multichannel", channel="facebook", tone="natural")
        else:
            logger.info("agent_thinking_multichannel", channel="whatsapp", tone="standard")

        # 4. Prepare Agent Payload
        agent_request = {
            "tenant_id": tenant_id,
            "message": content,
            "history": remote_history,
            "context": {
                "store_name": tenant_row['store_name'],
                "system_prompt": sys_template,
                "current_channel": channel_source
            },
            "agent_config": {
                "tools": enabled_tools,
                "tool_instructions": tool_instructions_list,
                "model": model_config
            },
            "credentials": {
                "openai_api_key": decrypt_password(tenant_row['openai_api_key_enc']) if tenant_row.get('openai_api_key_enc') else OPENAI_API_KEY,
                "tiendanube_store_id": tenant_row['tiendanube_store_id'],
                "tiendanube_access_token": decrypt_password(tenant_row['tiendanube_access_token_enc']) if tenant_row.get('tiendanube_access_token_enc') else None,
                "tiendanube_service_url": TIENDANUBE_SERVICE_URL
            },
            "internal_secret": INTERNAL_SECRET_KEY
        }

        # 5. Call Agent Service
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{AGENT_SERVICE_URL}/v1/agent/execute", 
                json=agent_request,
                headers={"X-Internal-Secret": INTERNAL_SECRET_KEY}
            )
            resp.raise_for_status()
            agent_result = resp.json()
            
            # 6. Deliver and Persist Response
            final_messages = agent_result.get("messages", [])
            
            for msg_obj in final_messages:
                text_content = msg_obj.get("text", "")
                
                # Protocol Omega: JSON Sanitizer
                # If the agent accidentally returns a JSON string as text, try to extract the real text.
                if text_content.strip().startswith("{") and '"text":' in text_content:
                    try:
                        potential_json = json.loads(text_content)
                        if isinstance(potential_json, dict):
                            # Try to find text in different places
                            text_content = potential_json.get("text") or \
                                          (potential_json.get("messages", [{}])[0].get("text")) or \
                                          text_content
                    except:
                        pass # Not valid JSON or parsing failed, keep original text
                
                if "HUMAN_HANDOFF_REQUESTED:" in text_content:
                    reason = text_content.split("HUMAN_HANDOFF_REQUESTED:")[1].strip()
                    await trigger_human_handoff_v3(from_number, tenant_id, conv_id, reason, customer_name)
                    continue
                
                # Persist Agent Response
                metadata = msg_obj.get("metadata", {})
                await db.pool.execute("""
                    INSERT INTO chat_messages (id, tenant_id, conversation_id, role, content, correlation_id, created_at, from_number, meta, channel_source)
                    VALUES ($1, $2, $3, 'assistant', $4, $5, NOW(), $6, $7, (SELECT channel_source FROM chat_conversations WHERE id = $3))
                """, uuid.uuid4(), tenant_id, conv_id, text_content, correlation_id, from_number, json.dumps(metadata))
                
                logger.info("agent_response_persisted", from_number=from_number)

                # 6b. Delivery to Gateway (Nexus v4.0 Multichannel)
                # Fetch full conversation metadata for delivery
                conv_meta = await db.pool.fetchrow("""
                    SELECT channel_source, external_chatwoot_id, external_account_id, external_user_id 
                    FROM chat_conversations WHERE id = $1
                """, conv_id)

                if conv_meta:
                    logger.info("delivery_metadata_fetched", 
                                channel=conv_meta['channel_source'], 
                                cw_id=conv_meta['external_chatwoot_id'],
                                account_id=conv_meta['external_account_id'])
                    async with httpx.AsyncClient() as gateway_client:
                        try:
                            wh_url = os.getenv("WH_SERVICE_URL", "http://whatsapp_service:8002")
                            delivery_payload = {
                                "to": conv_meta['external_user_id'],
                                "text": text_content,
                                "imageUrl": msg_obj.get("imageUrl"),
                                "channel_source": conv_meta['channel_source'],
                                "external_chatwoot_id": conv_meta['external_chatwoot_id'],
                                "external_account_id": conv_meta['external_account_id']
                            }
                            logger.info("sending_to_gateway", url=f"{wh_url}/messages/send", payload_keys=list(delivery_payload.keys()))
                            resp = await gateway_client.post(
                                f"{wh_url}/messages/send",
                                json=delivery_payload,
                                headers={"X-Internal-Token": str(INTERNAL_SECRET_KEY)}
                            )
                            logger.info("gateway_response_received", status=resp.status_code, body=resp.text)
                            logger.info("agent_response_delivered_to_gateway", channel=conv_meta['channel_source'])
                        except Exception as de:
                            logger.error("gateway_delivery_failed", error=str(de))
                else:
                    logger.warning("conv_meta_not_found_for_delivery", conv_id=str(conv_id))

        # Track Usage
        await db.pool.execute("UPDATE tenants SET total_tool_calls = total_tool_calls + 1 WHERE id = $1", tenant_id)

    except Exception as e:
        logger.error("agent_execution_failed", error=str(e), tenant_id=tenant_id)

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
             # 1. Try to fetch SMTP config from Credentials (priority: tenant > global)
             smtp_cred_json = await db.pool.fetchval("""
                 SELECT value FROM credentials 
                 WHERE category = 'smtp' 
                 AND (tenant_id = $1 OR (scope = 'global' AND tenant_id IS NULL))
                 ORDER BY CASE WHEN tenant_id IS NOT NULL THEN 0 ELSE 1 END
                 LIMIT 1
             """, tenant_id)
             
             smtp_cfg = {}
             if smtp_cred_json:
                 try: smtp_cfg = json.loads(smtp_cred_json)
                 except: pass
             
             # 2. Fallback to Env Vars (handled by TiendaNube Service if not passed)
             # But if we found creds, we pass them.
             
             email_payload = {
                 "to_email": tenant_settings['handoff_target_email'],
                 "subject": f"🚨 Solicitud de Humano: {tenant_settings['store_name']}",
                 "text": f"El cliente {customer_name} ({from_number}) solicita atención humana.\nMotivo: {reason}\n\nIngresa al panel para responder: https://app.nexus-ai.com",
                 "smtp_host": smtp_cfg.get("host"),
                 "smtp_port": int(smtp_cfg.get("port")) if smtp_cfg.get("port") else None,
                 "smtp_user": smtp_cfg.get("user"),
                 "smtp_password": smtp_cfg.get("pass")
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
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.3;
        ALTER TABLE agents ALTER COLUMN whatsapp_number DROP NOT NULL;
        ALTER TABLE agents ALTER COLUMN system_prompt_template SET NOT NULL;
    END IF;

    -- Customers (Ghost Table Fix)
    CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
        phone_number TEXT NOT NULL,
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
    END IF;

    -- Identity Link (Repair Roto)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chat_conversations') THEN
         ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
    END IF;

    -- Tool Config (The "Custom Guides" Requirement)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tenants') THEN
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tool_config JSONB DEFAULT '{}';
    END IF;

END $$;
""")

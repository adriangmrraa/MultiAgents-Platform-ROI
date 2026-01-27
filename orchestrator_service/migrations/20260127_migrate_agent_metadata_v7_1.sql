-- Migration v7.1.0: Agent Metadata & Vault Sync
-- Objective: Move tenant metadata to agents and sync existing TiendaNube tokens to Vault.

DO $$
BEGIN
    -- 1. Migrate business metadata to agents table
    -- We assume the 'metadata' column in 'agents' is JSONB.
    -- We map store_website, store_description, store_catalog_knowledge.
    
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
    AND (t.store_website IS NOT NULL OR t.store_description IS NOT NULL OR t.store_catalog_knowledge IS NOT NULL);

    -- 2. Sync existing TiendaNube credentials to Vault (credentials table)
    -- This assumes credential_types for TiendaNube exist (handled by Maintenance Robot in main.py)
    
    -- Sync access_token
    INSERT INTO credentials (tenant_id, category, name, value, scope, created_at, updated_at)
    SELECT 
        id as tenant_id,
        'tiendanube' as category,
        'access_token' as name,
        tiendanube_access_token as value,
        'tenant' as scope,
        NOW() as created_at,
        NOW() as updated_at
    FROM tenants
    WHERE tiendanube_access_token IS NOT NULL
    ON CONFLICT (tenant_id, category, name) DO UPDATE 
    SET value = EXCLUDED.value, updated_at = NOW();

    -- Sync store_id (as a non-sensitive but related credential)
    INSERT INTO credentials (tenant_id, category, name, value, scope, created_at, updated_at)
    SELECT 
        id as tenant_id,
        'tiendanube' as category,
        'store_id' as name,
        tiendanube_store_id as value,
        'tenant' as scope,
        NOW() as created_at,
        NOW() as updated_at
    FROM tenants
    WHERE tiendanube_store_id IS NOT NULL
    ON CONFLICT (tenant_id, category, name) DO UPDATE 
    SET value = EXCLUDED.value, updated_at = NOW();

    RAISE NOTICE 'Migration v7.1.0 completed successfully.';
END $$;

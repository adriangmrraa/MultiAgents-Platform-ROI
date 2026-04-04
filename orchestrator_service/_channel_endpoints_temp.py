# === Multi-Tenant Channel Bindings (v7.0) ===


@router.get("/channels/bindings", dependencies=[Depends(verify_admin_token)])
async def list_channel_bindings(current_user: User = Depends(get_current_user)):
    """
    Returns all channel bindings for the current tenant.
    Multi-Tenant Architecture v7.0
    """
    tenant_id = current_user.tenant_id
    query = """
        SELECT id, provider, channel_id, label, created_at, updated_at
        FROM channel_bindings
        WHERE tenant_id = $1
        ORDER BY created_at DESC
    """
    rows = await db.pool.fetch(query, tenant_id)
    return {"bindings": [dict(r) for r in rows]}


@router.post("/channels/bind", dependencies=[Depends(verify_admin_token)])
async def bind_channel(payload: dict, current_user: User = Depends(get_current_user)):
    """
    Binds a new channel to the current tenant.
    Validates uniqueness to prevent channel conflicts.
    """
    tenant_id = current_user.tenant_id
    provider = payload.get("provider")
    channel_id = payload.get("channel_id")
    label = payload.get("label", f"{provider} {channel_id}")

    if not provider or not channel_id:
        raise HTTPException(400, detail="Missing required fields: provider, channel_id")

    # Check for existing binding
    existing = await db.pool.fetchrow(
        "SELECT tenant_id FROM channel_bindings WHERE provider = $1 AND channel_id = $2",
        provider,
        channel_id,
    )
    if existing:
        raise HTTPException(
            409, detail=f"Channel already bound to tenant {existing['tenant_id']}"
        )

    # Create binding
    await db.pool.execute(
        """INSERT INTO channel_bindings (tenant_id, provider, channel_id, label) 
           VALUES ($1, $2, $3, $4)""",
        tenant_id,
        provider,
        channel_id,
        label,
    )

    # Audit log
    logger.info(
        "channel_binding_created",
        extra={
            "tenant_id": tenant_id,
            "provider": provider,
            "channel_id": channel_id,
            "actor": current_user.email,
        },
    )

    return {"status": "bound", "provider": provider, "channel_id": channel_id}


@router.delete(
    "/channels/unbind/{binding_id}", dependencies=[Depends(verify_admin_token)]
)
async def unbind_channel(
    binding_id: int, current_user: User = Depends(get_current_user)
):
    """
    Removes a channel binding.
    Verifies ownership before deletion.
    """
    tenant_id = current_user.tenant_id

    # Verify ownership
    binding = await db.pool.fetchrow(
        "SELECT provider, channel_id FROM channel_bindings WHERE id = $1 AND tenant_id = $2",
        binding_id,
        tenant_id,
    )
    if not binding:
        raise HTTPException(404, detail="Binding not found or not owned by you")

    await db.pool.execute("DELETE FROM channel_bindings WHERE id = $1", binding_id)

    # Audit log
    logger.info(
        "channel_binding_deleted",
        extra={
            "tenant_id": tenant_id,
            "binding_id": binding_id,
            "actor": current_user.email,
        },
    )

    return {"status": "unbound"}


@router.get("/internal/routing/resolve", dependencies=[Depends(verify_internal_token)])
async def resolve_tenant_from_channel(provider: str, channel_id: str):
    """
    Resolves tenant_id from external channel identifier.
    Critical endpoint for multi-tenant webhook routing.
    Uses Redis caching for performance.
    """
    # Try Redis cache first
    cache_key = f"channel_route:{provider}:{channel_id}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            data = json.loads(cached)
            logger.info(
                "tenant_resolution_cache_hit",
                extra={"provider": provider, "channel_id": channel_id},
            )
            return data
    except Exception as e:
        logger.warning(f"Redis cache miss: {e}")

    # Query database
    row = await db.pool.fetchrow(
        """SELECT tenant_id, (SELECT store_name FROM tenants WHERE id = tenant_id) as tenant_name
           FROM channel_bindings WHERE provider = $1 AND channel_id = $2""",
        provider,
        channel_id,
    )

    if not row:
        logger.warning(
            "tenant_resolution_failed",
            extra={"provider": provider, "channel_id": channel_id},
        )
        raise HTTPException(404, detail="Channel not bound to any tenant")

    result = {
        "tenant_id": row["tenant_id"],
        "tenant_name": row["tenant_name"],
        "resolved_at": datetime.utcnow().isoformat(),
    }

    # Cache for 5 minutes
    try:
        await redis_client.setex(cache_key, 300, json.dumps(result))
    except Exception as e:
        logger.warning("redis_cache_set_failed", error=str(e))

    logger.info(
        "tenant_resolution_success",
        extra={
            "provider": provider,
            "channel_id": channel_id,
            "tenant_id": row["tenant_id"],
        },
    )

    return result

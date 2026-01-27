---
description: Workflow para agregar/gestionar documentos RAG en Platform AI Solutions
---

# 📚 RAG Document Management Workflow

Proceso completo para gestión de la Base de Conocimiento (Sovereign Library).

## 🛠 Skills Recomendadas
- **Base de Datos & Vectores**: [DB_Evolution](../skills/DB_Evolution/SKILL.md)
- **Backend Processing**: [Backend_Sovereign](../skills/Backend_Sovereign/SKILL.md)
- **Security**: [Credential_Vault_Specialist](../skills/Credential_Vault_Specialist/SKILL.md)


## Concepto: Arquitectura RAG Híbrida

**PostgreSQL Local**: Metadata (`rag_documents` table)  
**Supabase Remote**: Vectores (embeddings vía pgvector)

### Colecciones Disponibles
- **General**: Manuales técnicos, políticas (PDF/DOCX)
- **ADN Personal**: Historiales de conversación para clonación de estilo
- **Shadow RAG**: Memoria automática de chats (background worker)

---

## Workflow 1: Agregar Documento (Upload & Index)

### Fase 1: Preparación

#### 1.1. Validar Archivo
- [ ] **Formato soportado**: PDF, TXT, DOCX, MD
- [ ] **Tamaño**: < 10MB
- [ ] **Encoding**: UTF-8 preferido (sistema tiene fallback)
- [ ] **Tenant credentials**: OpenAI API key configurada

#### 1.2. Seleccionar Colección
```typescript
// Frontend
const collections = ['General', 'ADN Personal', 'Shadow RAG'];
const selectedCollection = 'General';
```

### Fase 2: Upload (Frontend)

#### 2.1. Implementar Upload UI
```tsx
const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('collection', selectedCollection);
  
  // Para ADN Personal con archivos .txt
  if (selectedCollection === 'ADN Personal' && file.name.endsWith('.txt')) {
    const heroName = prompt('Ingresa el nombre del héroe (autor principal):');
    formData.append('hero_name', heroName);
  }

  await execute({
    method: 'POST',
    url: '/admin/knowledge/upload',
    data: formData
  });
};
```

### Fase 3: Processing (Backend)

#### 3.1. Recepción y Validación
```python
# orchestrator_service/app/api/v1/endpoints/knowledge.py

@router.post("/knowledge/upload")
async def upload_document(
    file: UploadFile,
    collection: str,
    hero_name: Optional[str] = None,
    current_user = Depends(verify_admin_token),
    session: AsyncSession = Depends(get_session)
):
    # Resolver tenant
    tenant_id = await resolve_tenant(current_user.id)
    
    # Validar extensión
    allowed_extensions = ['.pdf', '.txt', '.docx', '.md']
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Format not supported. Use: {allowed_extensions}"
        )
    
    # Validar tamaño (10MB)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="File size exceeds 10MB limit"
        )
    
    # Guardar archivo físico
    storage_path = f"/app/storage/tenants/{tenant_id}/{file.filename}"
    os.makedirs(os.path.dirname(storage_path), exist_ok=True)
    with open(storage_path, 'wb') as f:
        f.write(file_content)
    
    # Crear registro en DB
    doc = RAGDocument(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        filename=file.filename,
        collection=collection,
        file_type=file_ext[1:],  # sin el punto
        file_path=storage_path,
        status='processing'
    )
    session.add(doc)
    await session.flush()
    
    # Delegar vectorización a background task
    background_tasks.add_task(
        vectorize_document,
        doc_id=doc.id,
        file_content=file_content,
        tenant_id=tenant_id,
        collection=collection,
        hero_name=hero_name
    )
    
    await session.commit()
    return {"id": doc.id, "status": "processing"}
```

#### 3.2. Vectorización (Background Task)
```python
async def vectorize_document(
    doc_id: str,
    file_content: bytes,
    tenant_id: int,
    collection: str,
    hero_name: Optional[str] = None
):
    try:
        # Extraer texto
        text = extract_text(file_content, file_type)
        
        # Aplicar parser específico
        if collection == "ADN Personal" and hero_name:
            from app.services.parsers import WhatsAppParser
            parser = WhatsAppParser(hero_name=hero_name)
            chunks = parser.parse(text)
        else:
            # Chunking estándar (500-1000 tokens)
            chunks = text_splitter.split_text(text)
        
        # Obtener credenciales del tenant
        openai_key = await get_tenant_credential(
            tenant_id=tenant_id,
            category="openai"
        )
        
        # Generar embeddings
        from openai import OpenAI
        client = OpenAI(api_key=openai_key)
        
        embeddings = []
        for i, chunk in enumerate(chunks):
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=chunk
            )
            embeddings.append({
                "content": chunk,
                "embedding": response.data[0].embedding,
                "metadata": {
                    "tenant_id": tenant_id,
                    "source_id": doc_id,
                    "collection": collection,
                    "chunk_index": i
                }
            })
        
        # Almacenar en Supabase
        from app.services.rag.supabase_vector_store import SupabaseVectorStore
        vector_store = SupabaseVectorStore()
        await vector_store.add_documents(embeddings)
        
        # Actualizar status en PostgreSQL
        async with get_session() as session:
            stmt = select(RAGDocument).where(RAGDocument.id == doc_id)
            result = await session.execute(stmt)
            doc = result.scalar_one()
            doc.status = 'active'
            doc.chunk_count = len(chunks)
            await session.commit()
        
        logger.info(f"Document {doc_id} vectorized successfully")
        
    except Exception as e:
        logger.error(f"Vectorization failed for {doc_id}: {str(e)}")
        # Marcar como error en DB
        async with get_session() as session:
            stmt = select(RAGDocument).where(RAGDocument.id == doc_id)
            result = await session.execute(stmt)
            doc = result.scalar_one()
            doc.status = 'error'
            await session.commit()
```

---

## Workflow 2: Eliminar Documento (Hard Delete)

### Fase 1: Dual Delete Protocol

#### 1.1. Eliminar desde Frontend
```tsx
const handleDelete = async (docId: string) => {
  if (!confirm('¿Eliminar documento? Esta acción es irreversible.')) {
    return;
  }

  await execute({
    method: 'DELETE',
    url: `/admin/knowledge/${docId}`
  });
  
  toast.success('Document deleted');
  reloadDocuments();
};
```

#### 1.2. Backend Deletion (Surgical Strike)
```python
@router.delete("/knowledge/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user = Depends(verify_admin_token),
    session: AsyncSession = Depends(get_session)
):
    tenant_id = await resolve_tenant(current_user.id)
    
    # Obtener documento
    stmt = select(RAGDocument).where(
        RAGDocument.id == doc_id,
        RAGDocument.tenant_id == tenant_id
    )
    result = await session.execute(stmt)
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Paso 1: Eliminar vectores de Supabase (Remoto)
    try:
        await supabase.from_("documents").delete().eq(
            "metadata->>source_id", doc_id
        ).execute()
        logger.info(f"Vectors deleted from Supabase for {doc_id}")
    except Exception as e:
        logger.warning(f"Failed to delete vectors: {e}")
        # Continuar para eliminar metadata (fail-safe)
    
    # Paso 2: Eliminar archivo físico (Disco)
    try:
        if doc.file_path and os.path.exists(doc.file_path):
            os.remove(doc.file_path)
            logger.info(f"Physical file deleted: {doc.file_path}")
    except Exception as e:
        logger.warning(f"Failed to delete physical file: {e}")
    
    # Paso 3: Eliminar metadata de PostgreSQL (Local)
    await session.delete(doc)
    await session.commit()
    
    return {"message": "Document deleted successfully"}
```

---

## Workflow 3: Búsqueda RAG (Query Knowledge)

### Fase 1: Query Execution

```python
from app.services.rag.retrieval import RAGRetriever

async def search_knowledge(
    query: str,
    tenant_id: int,
    collection: Optional[str] = None,
    top_k: int = 5
) -> List[dict]:
    """
    Búsqueda semántica en la base de conocimiento
    
    Args:
        query: Pregunta del usuario
        tenant_id: ID del tenant (multi-tenant isolation)
        collection: Filtrar por colección específica
        top_k: Número de resultados a retornar
    
    Returns:
        Lista de chunks relevantes con metadata
    """
    # Generar embedding del query
    openai_key = await get_tenant_credential(
        tenant_id=tenant_id,
        category="openai"
    )
    
    client = OpenAI(api_key=openai_key)
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=query
    )
    query_embedding = response.data[0].embedding
    
    # Buscar en Supabase con filtros
    metadata_filter = {"tenant_id": tenant_id}
    if collection:
        metadata_filter["collection"] = collection
    
    results = await supabase.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_count": top_k,
            "filter": metadata_filter
        }
    ).execute()
    
    return results.data
```

---

## Workflow 4: Monitoring & Maintenance

### 4.1. Listar Documentos
```python
@router.get("/knowledge/list")
async def list_documents(
    collection: Optional[str] = None,
    current_user = Depends(verify_admin_token),
    session: AsyncSession = Depends(get_session)
):
    tenant_id = await resolve_tenant(current_user.id)
    
    stmt = select(RAGDocument).where(
        RAGDocument.tenant_id == tenant_id
    )
    
    if collection:
        stmt = stmt.where(RAGDocument.collection == collection)
    
    stmt = stmt.order_by(RAGDocument.created_at.desc())
    
    result = await session.execute(stmt)
    docs = result.scalars().all()
    
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "collection": doc.collection,
            "status": doc.status,
            "chunk_count": doc.chunk_count,
            "created_at": doc.created_at
        }
        for doc in docs
    ]
```

### 4.2. Resolver Documentos en "processing" Eternos
```python
# Script de mantenimiento
async def fix_stuck_documents():
    """Detectar y reintegrar documentos atascados"""
    
    # Documentos en processing por más de 10 minutos
    cutoff = datetime.utcnow() - timedelta(minutes=10)
    
    stmt = select(RAGDocument).where(
        RAGDocument.status == 'processing',
        RAGDocument.created_at < cutoff
    )
    
    result = await session.execute(stmt)
    stuck_docs = result.scalars().all()
    
    for doc in stuck_docs:
        logger.warning(f"Re-processing stuck document: {doc.id}")
        # Reintentar vectorización
        await vectorize_document(
            doc_id=doc.id,
            file_path=doc.file_path,
            tenant_id=doc.tenant_id,
            collection=doc.collection
        )
```

---

## Checklist Final

### Upload
- [ ] Archivo validado (formato + tamaño)
- [ ] Colección seleccionada
- [ ] Metadata guardada en PostgreSQL
- [ ] Vectorización completada en Supabase
- [ ] Status = 'active' en DB

### Delete
- [ ] Vectores eliminados de Supabase
- [ ] Archivo físico eliminado
- [ ] Metadata eliminada de PostgreSQL
- [ ] UI actualizada

### Search
- [ ] Filtro por tenant_id aplicado
- [ ] Colección filtrada (si aplica)
- [ ] Top-K chunks retornados
- [ ] Metadata incluida en respuesta

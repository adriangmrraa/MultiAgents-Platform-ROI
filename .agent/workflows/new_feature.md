---
description: 
---

# Workflow: Crear Nueva Feature en Platform AI Solutions

Este workflow define el proceso estandarizado para implementar nuevas funcionalidades en el proyecto, garantizando calidad, seguridad multi-tenant y coherencia arquitectónica.

---
## 1. Análisis de Impacto

Antes de escribir código, responde estas preguntas:

### Base de Datos
- [ ] **¿Requiere cambios en el esquema PostgreSQL?**
  - Si es tabla nueva: Crear modelo en `app/models/` y reiniciar
  - Si es modificación a tabla existente: Crear script en `scripts/migration_steps.py`
  
- [ ] **¿Requiere almacenamiento de vectores (RAG)?**
  - Si SÍ: Planear sincronización PostgreSQL (metadata) + Supabase (embeddings)

### Credenciales
- [ ] **¿Requiere nuevas credenciales externas?**
  - Si SÍ: Agregar categoría a `app/core/credentials.py`
  - Ejemplos: Nueva API de terceros, OAuth tokens, webhooks

### Servicios
- [ ] **¿Qué servicios se verán afectados?**
  - `orchestrator_service`: API principal (siempre)
  - `agent_service`: Si involucra inferencia LLM
  - `whatsapp_service`: Si afecta canal WhatsApp
  - `meta_service`: Si afecta Facebook/Instagram
  - `frontend_react`: Si hay cambios UI

### Multi-Tenancy
- [ ] **¿La feature maneja datos de usuarios?**
  - Si SÍ: Validar que **todas** las queries filtren por `tenant_id`
  - Revisar `agents.md` sección "Security - Multi-Tenant Isolation"

---

## 2. Backend First (Orchestrator Service)

### 2.1. Definir Pydantic Schemas

**Ubicación**: `orchestrator_service/app/schemas/`

```python
# app/schemas/nueva_feature.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class FeatureBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class FeatureCreate(FeatureBase):
    """Schema para requests de creación"""
    pass

class FeatureUpdate(BaseModel):
    """Schema para requests de actualización"""
    name: Optional[str] = None
    description: Optional[str] = None

class FeatureResponse(FeatureBase):
    """Schema para responses (incluye campos auto-generados)"""
    id: int
    tenant_id: int
    created_at: datetime
    
    model_config = {"from_attributes": True}
```

### 2.2. Crear Modelo SQLAlchemy (si aplica)

**Ubicación**: `orchestrator_service/app/models/`

```python
# app/models/nueva_feature.py
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey
from datetime import datetime
from .base import Base

class Feature(Base):
    __tablename__ = "features"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    
    # Relación
    tenant: Mapped["Tenant"] = relationship(back_populates="features")
```

**Importante**: Agregar a `app/models/__init__.py`:
```python
from .nueva_feature import Feature
```

### 2.3. Crear Servicio (Lógica de Negocio)

**Ubicación**: `orchestrator_service/app/services/`

```python
# app/services/feature_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Feature
from app.schemas import FeatureCreate, FeatureUpdate

class FeatureService:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_feature(
        self,
        data: FeatureCreate,
        tenant_id: int
    ) -> Feature:
        feature = Feature(
            **data.model_dump(),
            tenant_id=tenant_id
        )
        self.session.add(feature)
        await self.session.commit()
        await self.session.refresh(feature)
        return feature
    
    async def get_feature(
        self,
        feature_id: int,
        tenant_id: int
    ) -> Optional[Feature]:
        stmt = select(Feature).where(
            Feature.id == feature_id,
            Feature.tenant_id == tenant_id  # ¡CRÍTICO!
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_features(self, tenant_id: int) -> list[Feature]:
        stmt = select(Feature).where(
            Feature.tenant_id == tenant_id
        ).order_by(Feature.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def update_feature(
        self,
        feature_id: int,
        tenant_id: int,
        data: FeatureUpdate
    ) -> Optional[Feature]:
        feature = await self.get_feature(feature_id, tenant_id)
        if not feature:
            return None
        
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(feature, key, value)
        
        await self.session.commit()
        await self.session.refresh(feature)
        return feature
    
    async def delete_feature(
        self,
        feature_id: int,
        tenant_id: int
    ) -> bool:
        feature = await self.get_feature(feature_id, tenant_id)
        if not feature:
            return False
        
        await self.session.delete(feature)
        await self.session.commit()
        return True
```

### 2.4. Crear Endpoint

**Ubicación**: `orchestrator_service/app/api/v1/endpoints/`

```python
# app/api/v1/endpoints/features.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core import deps
from app.schemas import FeatureCreate, FeatureUpdate, FeatureResponse
from app.services.feature_service import FeatureService
from app.models import User

router = APIRouter()

@router.post("/features", response_model=FeatureResponse, status_code=201)
async def create_feature(
    data: FeatureCreate,
    current_user: User = Depends(deps.get_current_active_user),
    session: AsyncSession = Depends(deps.get_session)
):
    service = FeatureService(session)
    feature = await service.create_feature(data, current_user.tenant_id)
    return feature

@router.get("/features", response_model=list[FeatureResponse])
async def list_features(
    current_user: User = Depends(deps.get_current_active_user),
    session: AsyncSession = Depends(deps.get_session)
):
    service = FeatureService(session)
    features = await service.list_features(current_user.tenant_id)
    return features

@router.get("/features/{feature_id}", response_model=FeatureResponse)
async def get_feature(
    feature_id: int,
    current_user: User = Depends(deps.get_current_active_user),
    session: AsyncSession = Depends(deps.get_session)
):
    service = FeatureService(session)
    feature = await service.get_feature(feature_id, current_user.tenant_id)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature

@router.put("/features/{feature_id}", response_model=FeatureResponse)
async def update_feature(
    feature_id: int,
    data: FeatureUpdate,
    current_user: User = Depends(deps.get_current_active_user),
    session: AsyncSession = Depends(deps.get_session)
):
    service = FeatureService(session)
    feature = await service.update_feature(feature_id, current_user.tenant_id, data)
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")
    return feature

@router.delete("/features/{feature_id}", status_code=204)
async def delete_feature(
    feature_id: int,
    current_user: User = Depends(deps.get_current_active_user),
    session: AsyncSession = Depends(deps.get_session)
):
    service = FeatureService(session)
    deleted = await service.delete_feature(feature_id, current_user.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Feature not found")
```

### 2.5. Registrar Router

**En**: `orchestrator_service/main.py` o `app/api/v1/router.py`

```python
from app.api.v1.endpoints import features

app.include_router(
    features.router,
    prefix="/api/v1",
    tags=["features"]
)
```

---

## 3. Frontend Implementation

### 3.1. Crear TypeScript Types

**Ubicación**: `frontend_react/src/types/`

```tsx
// src/types/feature.ts
export interface Feature {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface FeatureCreate {
  name: string;
  description?: string;
}

export interface FeatureUpdate {
  name?: string;
  description?: string;
}
```

### 3.2. Crear View o Component

**Ubicación**: `frontend_react/src/views/` (página completa) o `src/components/` (reutilizable)

```tsx
// src/views/Features.tsx
import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Feature, FeatureCreate } from '../types/feature';
import { Plus, Trash2 } from 'lucide-react';

export const Features: React.FC = () => {
  const { data: features, isLoading, error, execute } = useApi<Feature[]>();
  const { execute: createFeature } = useApi<Feature>();
  const { execute: deleteFeature } = useApi<void>();
  
  const [formData, setFormData] = useState<FeatureCreate>({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    await execute({
      method: 'GET',
      url: '/api/v1/features'
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createFeature({
      method: 'POST',
      url: '/api/v1/features',
      data: formData
    });
    setFormData({ name: '', description: '' });
    loadFeatures();
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar feature?')) {
      await deleteFeature({
        method: 'DELETE',
        url: `/api/v1/features/${id}`
      });
      loadFeatures();
    }
  };

  if (isLoading) return <div className="flex justify-center p-8">Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Features</h1>
      
      {/* Form */}
      <form onSubmit={handleCreate} className="mb-6 p-4 bg-gray-100 rounded-lg">
        <input
          type="text"
          placeholder="Feature name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded mb-2"
          required
        />
        <textarea
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded mb-2"
        />
        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <Plus size={16} /> Create Feature
        </button>
      </form>

      {/* List */}
      <div className="grid gap-4">
        {features?.map((feature) => (
          <div key={feature.id} className="p-4 bg-white rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{feature.name}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
              <button
                onClick={() => handleDelete(feature.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 3.3. Agregar Ruta (si es nueva página)

**En**: `frontend_react/src/App.tsx`

```tsx
import { Features } from './views/Features';

// En el router
<Route path="/features" element={<Features />} />
```

---

## 4. Sovereign Check (Seguridad Multi-Tenant)

Antes de hacer commit, verificar:

### Backend
- [ ] ¿Todas las queries SELECT filtran por `tenant_id`?
- [ ] ¿Los endpoints inyectan `current_user = Depends(deps.get_current_active_user)`?
- [ ] ¿Los servicios reciben `tenant_id` como parámetro?
- [ ] ¿Las credenciales externas se obtienen con `get_decrypted_credential`?
- [ ] ¿Los errores usan `HTTPException` con códigos claros?

### Frontend
- [ ] ¿Se usa `useApi` hook para todas las llamadas?
- [ ] ¿Los loading states tienen feedback visual?
- [ ] ¿Los errores se muestran al usuario?
- [ ] ¿Las credenciales/tokens se muestran enmascaradas?

### Database
- [ ] ¿El modelo tiene `tenant_id` con índice?
- [ ] ¿El modelo está importado en `models/__init__.py`?
- [ ] ¿Si es RAG, se sincronizan PostgreSQL + Supabase?

---

## 5. Testing

### Backend Unit Test

```python
# tests/test_features.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_feature():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/features",
            json={"name": "Test Feature", "description": "Test"},
            headers={"Authorization": "Bearer test_token"}
        )
    assert response.status_code == 201
    assert response.json()["name"] == "Test Feature"
```

### Manual Testing

1. **Local**: Probar endpoint en `http://localhost:8000/docs` (Swagger UI)
2. **Frontend**: Verificar que la UI muestra datos correctos
3. **Multi-Tenant**: Crear datos con dos usuarios diferentes y verificar aislamiento

---

## 6. Deployment

### Checklist Pre-Deploy

- [ ] ¿Se ejecutó `docker-compose up` en local sin errores?
- [ ] ¿Las migraciones de esquema son idempotentes (`IF NOT EXISTS`)?
- [ ] ¿Las variables de entorno están configuradas en Render/EasyPanel?
- [ ] ¿Se probó con credenciales de staging antes de producción?

### Deploy Steps

1. **Commit changes**: `git add . && git commit -m "feat: add feature X"`
2. **Push**: `git push origin main`
3. **Monitor**: Revisar logs de Render/EasyPanel durante startup
4. **Validate**: Probar endpoint en staging antes de production

---

## 7. Documentación

### Actualizar Docs

- [ ] Agregar descripción de la feature en `README.md` (si es significativa)
- [ ] Documentar nuevos endpoints en swagger (automático con FastAPI)
- [ ] Actualizar `agents.md` si hay cambios arquitectónicos importantes

---

## Resumen

Este workflow garantiza:
1. **Análisis** antes de código
2. **Backend First** (API antes de UI)
3. **Seguridad Multi-Tenant** en cada paso
4. **Testing** antes de deploy
5. **Documentación** actualizada

Seguir este proceso reduce errores y mantiene la calidad del código.

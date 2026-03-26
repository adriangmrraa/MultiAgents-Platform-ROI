# PLAN: Nova Phase 2 + Phase 3 — Products CRUD + Agent Tools

## Specs:
- `specs/2026-03-26_nova-platform-assistant.spec.md`
- `specs/2026-03-26_internal-product-catalog.spec.md`

---

## PHASE 2: PRODUCTS — Catálogo Interno + CRUD por voz/UI

### 12 tareas

| # | Tarea | Complejidad |
|---|-------|-------------|
| P2-T1 | Migration: tabla `internal_products` | Baja |
| P2-T2 | Model SQLAlchemy `InternalProduct` | Baja |
| P2-T3 | CRUD endpoints `/admin/products` | Media |
| P2-T4 | Búsqueda interna (para tools del agente) | Media |
| P2-T5 | Auto-detect: TN o catálogo interno en las tools | Media |
| P2-T6 | Import Excel/CSV + template descargable | Media |
| P2-T7 | Upload de imágenes de productos | Media |
| P2-T8 | Frontend: página `/products` con grid + modal | Alta |
| P2-T9 | Frontend: import Excel UI | Media |
| P2-T10 | Nova tools: `agregar_producto`, `editar_producto`, etc. | Media |
| P2-T11 | Nova widget: integrar tools de productos | Baja |
| P2-T12 | Sidebar: agregar link a /products | Baja |

---

### P2-T1: Migration SQL
**Modificar**: `orchestrator_service/main.py` (migration_steps)

```sql
CREATE TABLE IF NOT EXISTS internal_products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT 'General',
    sku VARCHAR(50),
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    compare_at_price DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'ARS',
    stock INTEGER DEFAULT 0,
    track_stock BOOLEAN DEFAULT true,
    variants JSONB DEFAULT '[]',
    images JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    tags JSONB DEFAULT '[]',
    weight DECIMAL(8,2),
    slug VARCHAR(255),
    public_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_internal_products_tenant ON internal_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_products_category ON internal_products(tenant_id, category);
```

---

### P2-T2: Model SQLAlchemy
**Crear**: `orchestrator_service/app/models/internal_product.py`
**Modificar**: `orchestrator_service/app/models/__init__.py`

Standard SQLAlchemy model matching the table.

---

### P2-T3: CRUD Endpoints
**Crear**: `orchestrator_service/app/routes/product_routes.py`
**Registrar**: `orchestrator_service/main.py`

Router: `APIRouter(prefix="/admin/products", tags=["products"])`

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/admin/products` | GET | Listar (paginado, filtro categoría, search) |
| `/admin/products/{id}` | GET | Detalle |
| `/admin/products` | POST | Crear |
| `/admin/products/{id}` | PUT | Actualizar |
| `/admin/products/{id}` | DELETE | Eliminar |
| `/admin/products/bulk` | POST | Crear hasta 50 de una vez |
| `/admin/products/categories` | GET | Listar categorías únicas |

Schemas inline (mismo patrón que voice_widget_routes):
```python
class ProductCreate(BaseModel):
    name: str
    description: str = ""
    category: str = "General"
    price: float
    compare_at_price: float | None = None
    stock: int = 0
    variants: list = []
    images: list = []
    tags: list = []
```

---

### P2-T4: Endpoints de búsqueda interna (para tools del agente)
**Agregar en**: `orchestrator_service/app/routes/product_routes.py`

| Endpoint | Descripción |
|----------|-------------|
| `/internal/products/search?q=X&tenant_id=Y` | Buscar por keyword |
| `/internal/products/category/{cat}?tenant_id=Y` | Buscar por categoría |
| `/internal/products/featured?tenant_id=Y` | Productos destacados |

Retorna el **mismo formato que la API de Tienda Nube**:
```json
[{
    "name": {"es": "Remera de Algodón"},
    "variants": [{"price": "15000.00", "stock": 10}],
    "images": [{"src": "https://..."}],
    "permalink": "https://..."
}]
```

---

### P2-T5: Auto-detect TN vs catálogo interno
**Modificar**: `orchestrator_service/main.py` — donde se ejecutan las tools

En `process_buffer_task` (línea ~3400), cuando el agente llama a `search_specific_products`:

```python
# Antes: siempre iba a TN API
# Ahora: detecta fuente
tn_credentials = await get_tn_credentials(tenant_id)
if tn_credentials:
    results = await search_tiendanube(tn_credentials, query)
else:
    results = await search_internal_products(tenant_id, query)
```

Las tools del agente NO cambian — la detección es transparente.

---

### P2-T6: Import Excel/CSV
**Agregar en**: `orchestrator_service/app/routes/product_routes.py`

| Endpoint | Descripción |
|----------|-------------|
| `GET /admin/products/export-template` | Descargar CSV template vacío |
| `POST /admin/products/import` | Subir CSV/Excel, parsear, crear productos |

Template CSV:
```
nombre,descripcion,categoria,precio,precio_anterior,variante,stock,sku,imagen_url
Remera Algodón,Premium quality,Remeras,15000,18000,S,10,REM-S,https://...
Remera Algodón,Premium quality,Remeras,15000,18000,M,15,REM-M,
```

Productos con mismo nombre → se agrupan (variantes del mismo producto).

---

### P2-T7: Upload de imágenes
**Agregar en**: `orchestrator_service/app/routes/product_routes.py`

`POST /admin/products/{id}/images` — multipart upload, guarda en static o S3.
`DELETE /admin/products/{id}/images/{index}` — eliminar imagen por índice.

Almacenamiento: `/static/products/{tenant_id}/{product_id}/` o URL externa.

---

### P2-T8: Frontend — Página /products
**Crear**: `frontend_react/src/views/Products.tsx`
**Modificar**: `App.tsx` (ruta), `Sidebar.tsx` (nav item)

Layout:
- Header: "Mis Productos" + botones "Agregar" + "Importar"
- Filtros: categoría dropdown + search
- Grid de cards: foto, nombre, precio, stock, [Editar]
- Modal de agregar/editar con todos los campos
- Responsive

---

### P2-T9: Frontend — Import Excel UI
**Dentro de**: `Products.tsx`

- Botón "Importar" → abre modal
- Link "Descargar template" → descarga CSV
- Dropzone para subir archivo
- Preview de productos parseados antes de confirmar
- Botón "Confirmar importación"

---

### P2-T10: Nova tools de productos
**Modificar**: `orchestrator_service/app/routes/nova_routes.py` + `main.py` (WS handler)

Agregar tools al Realtime de Nova widget:
```python
nova_product_tools = [
    {"name": "agregar_producto", "description": "Crear producto nuevo", "parameters": {name, price, description, category, variants, stock}},
    {"name": "editar_producto", "description": "Modificar producto existente", "parameters": {product_id, field, value}},
    {"name": "eliminar_producto", "description": "Borrar producto", "parameters": {product_id}},
    {"name": "listar_productos", "description": "Ver catálogo resumido", "parameters": {category?}},
    {"name": "actualizar_stock", "description": "Cambio rápido de stock", "parameters": {product_id, variante, cantidad}},
    {"name": "crear_categoria", "description": "Nueva categoría", "parameters": {nombre}},
]
```

Handler: cada tool hace INSERT/UPDATE/DELETE en `internal_products`.

---

### P2-T11: Integrar en NovaWidget
**Modificar**: `NovaWidget.tsx`

Cuando la página es `/products`, Nova tiene contexto de productos y tools activas.
Nova puede decir: "Veo que tenés 3 productos sin foto. Querés que te ayude?"

---

### P2-T12: Sidebar
**Modificar**: `Sidebar.tsx`

Agregar NavItem para `/products`:
```tsx
<NavItem to="/products" icon={<Package size={20} />} label="Productos" desc="Catalogo interno" />
```

---

## PHASE 3: AGENT — Tools de gestión del agente por voz

### 6 tareas

| # | Tarea | Complejidad |
|---|-------|-------------|
| P3-T1 | Nova tool: `modificar_prompt` | Media |
| P3-T2 | Nova tool: `agregar_regla` + `agregar_sinonimo` | Media |
| P3-T3 | Nova tool: `ver_prompt_actual` | Baja |
| P3-T4 | Nova tool: `ver_errores_agente` | Media |
| P3-T5 | Backend: endpoint errores/derivaciones recientes | Media |
| P3-T6 | Frontend: NovaWidget muestra errores como sugerencias | Baja |

---

### P3-T1: Tool `modificar_prompt`
**Modificar**: Nova WS handler en `main.py`

```python
{"name": "modificar_prompt", "description": "Agregar o editar una seccion del system prompt del agente de ventas",
 "parameters": {"seccion": "string (identidad/tono/reglas/diccionario/nueva)", "contenido": "string"}}
```

Handler:
1. Lee `agents.system_prompt_template` del tenant
2. Si la sección existe → la reemplaza
3. Si es nueva → la agrega al final
4. Actualiza la DB
5. Retorna: "Prompt actualizado. La sección {X} ahora dice: {preview}"

---

### P3-T2: Tools `agregar_regla` + `agregar_sinonimo`
**Modificar**: Nova WS handler

```python
{"name": "agregar_regla", "parameters": {"regla": "string"}}
# Busca "## REGLAS" en el prompt → agrega nueva regla numerada al final

{"name": "agregar_sinonimo", "parameters": {"categoria": "string", "sinonimos": "string"}}
# Busca "## DICCIONARIO" → agrega nueva entrada o expande existente
```

---

### P3-T3: Tool `ver_prompt_actual`
**Modificar**: Nova WS handler

```python
{"name": "ver_prompt_actual"}
# Lee agents.system_prompt_template → retorna los primeros 500 chars
# O un resumen de las secciones con longitud de cada una
```

---

### P3-T4: Tool `ver_errores_agente`
**Modificar**: Nova WS handler

```python
{"name": "ver_errores_agente"}
# Query: últimas 10 derivaciones a humano del agente (últimas 24h)
# Para cada una: qué preguntó el usuario y por qué se derivó
# Retorna resumen para que Nova sugiera mejoras
```

---

### P3-T5: Backend endpoint errores recientes
**Agregar en**: `orchestrator_service/app/routes/nova_routes.py`

```python
@router.get("/agent-issues")
async def get_agent_issues(current_user = Depends(get_current_user)):
    """Últimas derivaciones y posibles errores del agente."""
    # Query chat_messages donde role=assistant AND content LIKE '%deriv%'
    # + el mensaje del usuario que lo causó
    # Retorna: [{user_message, agent_response, timestamp, channel}]
```

---

### P3-T6: NovaWidget muestra errores
**Modificar**: `NovaWidget.tsx`

En la página `/agents` o `/chats`, si hay errores recientes:
- Card: "🔴 El agente derivó 5 veces hoy. 3 fueron por preguntas de envío."
- Botón: "Agregar regla de envío" → Nova agrega la regla al prompt automáticamente

---

## DEPENDENCIAS

```
Phase 2:
P2-T1 → P2-T2 → P2-T3 → P2-T4 → P2-T5
P2-T3 → P2-T6 → P2-T9
P2-T3 → P2-T7
P2-T8 (paralelo con P2-T3+)
P2-T10 (después de P2-T3)
P2-T11 (después de P2-T10)
P2-T12 (paralelo)

Phase 3:
P3-T5 → P3-T4
P3-T1, P3-T2, P3-T3 (paralelos entre sí)
P3-T6 (después de P3-T4 + P3-T5)

Phase 2 y 3 son paralelas entre sí excepto P2-T10/T11 que deben ir antes de P3.
```

---

## VERIFICACIÓN END-TO-END

### Phase 2
1. Crear producto desde UI → aparece en grid
2. Editar precio → se actualiza
3. Importar CSV con 10 productos → preview → confirmar → 10 productos en grid
4. Subir imagen a producto → se muestra en la card
5. Hablar con Nova: "agregá una remera de algodón a 15000" → producto creado
6. El agente de ventas responde "qué productos tenés?" con productos del catálogo interno
7. Si el tenant tiene TN, usa TN. Si no, usa catálogo interno.

### Phase 3
1. Hablar con Nova: "agregá una regla: no dar descuentos sin autorización" → prompt actualizado
2. "Mostrá los errores del agente" → Nova lista las derivaciones recientes
3. "Agregá sinónimo: remera = camiseta, playera, franela" → diccionario actualizado
4. En /chats: Nova dice "El agente derivó 3 veces por envíos. Querés agregar reglas?"
5. Tocar la sugerencia → Nova agrega la regla automáticamente

---

## ESTIMACIÓN TOTAL

| Fase | Tareas | Complejidad |
|------|--------|-------------|
| Phase 2 | 12 tareas | **Alta** (página nueva + CRUD + import + tools) |
| Phase 3 | 6 tareas | **Media** (tools + endpoint + UI mínima) |
| Total | 18 tareas | ~2-3 sesiones de implementación |

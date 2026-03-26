# SPEC: Catalogo Interno de Productos — Alternativa a Tienda Nube

## Fecha: 2026-03-26
## Prioridad: P1 — Feature diferenciadora para usuarios sin Tienda Nube
## Problema: Usuarios sin Tienda Nube no pueden usar el agente de ventas con productos reales

---

## OBJETIVO

Crear un catalogo de productos interno dentro de Future Platform que funcione como alternativa a Tienda Nube. Los usuarios pueden cargar sus productos (foto, nombre, precio, descripcion, variantes, stock) y el agente de ventas los usa exactamente igual que usaria la API de Tienda Nube.

**Propuesta de valor**: No necesitas Tienda Nube. Carga tus productos directamente en Future y tu agente los vende por WhatsApp, Instagram y Facebook.

---

## FORMAS DE CARGAR PRODUCTOS

### 1. Carga manual (UI)
- Formulario: nombre, descripcion, precio, stock, variantes (talle/color), categoria
- Upload de fotos (1-5 por producto)
- Editar y eliminar desde la UI

### 2. Carga masiva (Excel/CSV)
- Descargar template Excel/CSV prellenado con columnas explicadas
- Subir el archivo con hasta 50 productos de una vez
- Validacion: campos requeridos, formato de precio, URLs de imagenes
- Preview antes de confirmar

### 3. Carga por voz (Nova)
- En el onboarding o en cualquier momento desde el wizard
- "Nova, agrega un producto: remera de algodon, talle S M L XL, precio 15000"
- Nova usa una tool `agregar_producto` para crear el producto
- Se puede adjuntar foto por chat (texto o voz + imagen)

### 4. Carga via API (para devs)
- `POST /api/products` — crear producto
- `PUT /api/products/{id}` — actualizar
- `DELETE /api/products/{id}` — eliminar
- `GET /api/products` — listar
- Compatible con el formato de Tienda Nube para migracion facil

---

## ESQUEMA DE DATOS

### Nueva tabla: `internal_products`

```sql
CREATE TABLE IF NOT EXISTS internal_products (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Producto
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT 'General',
    sku VARCHAR(50),

    -- Precio
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    compare_at_price DECIMAL(12,2),  -- precio tachado
    currency VARCHAR(3) DEFAULT 'ARS',

    -- Stock
    stock INTEGER DEFAULT 0,
    track_stock BOOLEAN DEFAULT true,

    -- Variantes (JSON array)
    variants JSONB DEFAULT '[]',
    -- Formato: [{"name": "Talle S", "price": 15000, "stock": 10}, ...]

    -- Imagenes (JSON array de URLs)
    images JSONB DEFAULT '[]',
    -- Formato: ["https://...", "https://..."]

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    tags JSONB DEFAULT '[]',
    weight DECIMAL(8,2),

    -- SEO / Pagina publica
    slug VARCHAR(255),
    public_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_internal_products_tenant ON internal_products(tenant_id);
CREATE INDEX idx_internal_products_category ON internal_products(tenant_id, category);
CREATE INDEX idx_internal_products_active ON internal_products(tenant_id, is_active);
```

### Formato de variantes (compatible con Tienda Nube)

```json
[
    {"id": 1, "name": "Talle S", "price": 15000, "stock": 10, "sku": "REM-S"},
    {"id": 2, "name": "Talle M", "price": 15000, "stock": 15, "sku": "REM-M"},
    {"id": 3, "name": "Talle L", "price": 15000, "stock": 8, "sku": "REM-L"},
    {"id": 4, "name": "Talle XL", "price": 16000, "stock": 5, "sku": "REM-XL"}
]
```

---

## ENDPOINTS API (compatibles con formato Tienda Nube)

### CRUD de productos

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/admin/products` | Listar productos del tenant (paginado, filtro por categoria) |
| GET | `/admin/products/{id}` | Detalle de un producto |
| POST | `/admin/products` | Crear producto (JSON o multipart con imagenes) |
| PUT | `/admin/products/{id}` | Actualizar producto |
| DELETE | `/admin/products/{id}` | Eliminar producto |
| POST | `/admin/products/bulk` | Carga masiva (JSON array de hasta 50 productos) |
| POST | `/admin/products/import` | Importar desde Excel/CSV |
| GET | `/admin/products/export-template` | Descargar template Excel/CSV vacio |

### Imagenes

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/admin/products/{id}/images` | Subir imagen (multipart) |
| DELETE | `/admin/products/{id}/images/{index}` | Eliminar imagen |

### Busqueda (para las tools del agente)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/internal/products/search?q=remera` | Buscar por keyword (reemplaza search_specific_products de TN) |
| GET | `/internal/products/category/{cat}` | Buscar por categoria (reemplaza search_by_category) |
| GET | `/internal/products/featured` | Productos destacados (reemplaza browse_general_storefront) |

**Estos endpoints internos devuelven el MISMO formato que la API de Tienda Nube** para que las tools del agente funcionen sin cambios.

---

## INTEGRACION CON EL AGENTE

### El agente no sabe si los productos vienen de Tienda Nube o del catalogo interno

Las tools `search_specific_products`, `search_by_category`, `browse_general_storefront` detectan automaticamente la fuente:

```python
async def search_products(tenant_id, query):
    # 1. Verificar si tiene Tienda Nube conectada
    tn_credentials = await get_tn_credentials(tenant_id)

    if tn_credentials:
        # Buscar en Tienda Nube API
        return await search_tiendanube(tn_credentials, query)
    else:
        # Buscar en catalogo interno
        return await search_internal_products(tenant_id, query)
```

El formato de respuesta es identico:
```json
{
    "name": "Remera de Algodon",
    "price": "15000.00",
    "variants": [{"name": "Talle S", "stock": 10}, ...],
    "images": [{"src": "https://..."}],
    "url": "https://future-store.com/producto/remera-algodon"
}
```

---

## PAGINA DE PRODUCTOS (Frontend)

### Ruta: `/products` (nueva pagina en sidebar)

```
┌──────────────────────────────────────────┐
│  Mis Productos          [+ Agregar] [↑ Importar]
│
│  Filtros: [Todas las categorias ▼] [Buscar...]
│
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  │ IMG  │ │ IMG  │ │ IMG  │ │ IMG  │
│  │ Rem  │ │ Cam  │ │ Pan  │ │ Zap  │
│  │$15000│ │$20000│ │$18000│ │$25000│
│  │ 33u  │ │ 15u  │ │ 20u  │ │ 10u  │
│  │[Edit]│ │[Edit]│ │[Edit]│ │[Edit]│
│  └──────┘ └──────┘ └──────┘ └──────┘
│
│  [Descargar Template Excel]
└──────────────────────────────────────────┘
```

### Modal de Agregar/Editar Producto

```
┌──────────────────────────────────────────┐
│  Agregar Producto                    [X] │
│                                          │
│  Nombre: [Remera de Algodon Premium]     │
│  Descripcion: [textarea]                 │
│  Categoria: [Remeras ▼]                  │
│  Precio: [$] [15000]                     │
│  Precio anterior: [$] [18000] (tachado)  │
│                                          │
│  Variantes:                              │
│  [+ Agregar variante]                    │
│  Talle S  $15000  Stock: 10  [x]         │
│  Talle M  $15000  Stock: 15  [x]         │
│  Talle L  $15000  Stock: 8   [x]         │
│                                          │
│  Imagenes:                               │
│  [📷 Subir fotos]                        │
│  [img1] [img2] [img3]                    │
│                                          │
│  [Guardar Producto]                      │
└──────────────────────────────────────────┘
```

---

## CARGA POR VOZ (Nova)

### Nueva tool para el Realtime de Nova:

```json
{
    "type": "function",
    "name": "agregar_producto",
    "description": "Agregar un producto al catalogo. Usar cuando el usuario describe un producto para vender.",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "description": {"type": "string"},
            "price": {"type": "number"},
            "category": {"type": "string"},
            "variants": {"type": "string", "description": "Variantes separadas por coma: S, M, L, XL"},
            "stock": {"type": "integer"}
        },
        "required": ["name", "price"]
    }
}
```

Flujo: "Nova, agrega una remera de algodon, talles S M L XL, precio 15000, stock 10 por talle"
→ Nova llama `agregar_producto({name: "Remera de Algodon", price: 15000, variants: "S, M, L, XL", stock: 10})`
→ Backend crea el producto en `internal_products`
→ Nova confirma: "Listo, agregue la Remera de Algodon a $15.000 con 4 variantes"

---

## CARGA MASIVA (Excel/CSV)

### Template descargable

Columnas:
| nombre | descripcion | categoria | precio | precio_anterior | talle_o_variante | stock | sku | imagen_url |
|--------|-------------|-----------|--------|-----------------|------------------|-------|-----|------------|
| Remera Algodon | Premium quality | Remeras | 15000 | 18000 | S | 10 | REM-S | https://... |
| Remera Algodon | Premium quality | Remeras | 15000 | 18000 | M | 15 | REM-M | |
| Remera Algodon | Premium quality | Remeras | 15000 | 18000 | L | 8 | REM-L | |

- Productos con mismo nombre se agrupan automaticamente
- Cada fila con variante diferente = variante del mismo producto
- `imagen_url` es opcional (se puede subir despues)

### Endpoint: `POST /admin/products/import`
- Acepta: `.xlsx`, `.csv`
- Parsea el archivo, valida campos
- Retorna preview con errores si los hay
- Confirma la importacion

---

## PAGINA PUBLICA (Tienda Online Basica)

### Ruta: `/{tenant_slug}` o subdominio

Una pagina publica donde los visitantes ven los productos del tenant:
- Grid de productos con foto, nombre, precio
- Detalle de producto con variantes
- Boton "Consultar por WhatsApp" → abre wa.me con mensaje prellenado
- Sin carrito ni checkout (eso lo maneja el agente por chat)
- Sin comision por venta

**Esto es futuro** — no se implementa ahora, pero la tabla esta preparada con `slug` y `public_url`.

---

## INTEGRACION CON ONBOARDING WIZARD

### Nuevo paso en el wizard (entre paso 1 y 2, o como sub-paso del 1):

Si el usuario NO tiene Tienda Nube:
1. "¿Cómo cargamos tus productos?"
   - Opcion A: "Tengo Tienda Nube" → flujo actual (Store ID + Token)
   - Opcion B: "Cargo mis productos manualmente" → formulario inline
   - Opcion C: "Subo un Excel" → upload + preview
   - Opcion D: "Se los dicto a Nova" → conversación de voz para cargar productos

### Limites Free Trial
- Hasta 50 productos en el catalogo interno
- Hasta 5 imagenes por producto
- Pro: 500 productos, Enterprise: ilimitado

---

## CRITERIOS DE ACEPTACION

### Catalogo
- [ ] Tabla internal_products creada con auto-migration
- [ ] CRUD completo con aislamiento por tenant_id
- [ ] Variantes como JSON array (compatible con formato TN)
- [ ] Imagenes subidas y almacenadas (URLs en JSON array)

### Busqueda (para el agente)
- [ ] Los endpoints internos devuelven el mismo formato que Tienda Nube API
- [ ] Las tools del agente detectan automaticamente: TN o catalogo interno
- [ ] El agente responde con productos reales del catalogo interno

### Carga
- [ ] UI: formulario de agregar/editar producto con variantes e imagenes
- [ ] Excel: template descargable + import con validacion + preview
- [ ] Voz: Nova puede agregar productos via tool `agregar_producto`
- [ ] Masivo: hasta 50 productos por import

### Pagina
- [ ] Ruta `/products` en sidebar
- [ ] Grid de productos con filtros por categoria
- [ ] Modal de edicion completo
- [ ] Mobile responsive

### Free Trial
- [ ] Limite de 50 productos
- [ ] Limite de 5 imagenes por producto

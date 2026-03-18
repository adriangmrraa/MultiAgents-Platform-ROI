# SPEC: ROI Real — Ventas de Tienda Nube en Dashboard + Atribucion de Ventas al Agente IA por Canal

## Fecha: 2026-03-18
## Prioridad: P0 — Estrategica (diferenciador de producto, prueba de valor del agente IA)

---

## PROBLEMA

1. El ROI actual es una **estimacion heuristica**: busca keywords como "tu pedido es el #" en mensajes y multiplica por un ticket promedio hardcodeado (ARS 45,000). No usa datos reales de ventas.
2. Un usuario con Tienda Nube conectada (OAuth completo, tokens validos) **no puede ver sus ventas reales** en el dashboard. No hay metricas de pedidos, montos, ni estados.
3. **No existe atribucion de ventas al agente IA**. Si el agente asiste una venta, no hay forma de saber que esa venta fue gracias al agente.
4. Los links de productos que el agente envia en **Facebook e Instagram** van sin tracking. Las compras que generan son invisibles para la plataforma.
5. En **WhatsApp** la atribucion seria directa (cruzar telefono del comprador con el customer que chateo con el agente), pero no se implemento.

---

## OBJETIVO

### Para el usuario (tenant)
- Ver en el dashboard **ventas reales** de su Tienda Nube: cantidad de pedidos, monto total, estados, tendencia
- Ver cuantas de esas ventas fueron **atribuidas al agente IA** y en que canal (WhatsApp, Facebook, Instagram)
- Tener un **ROI real** calculado: "El agente IA genero X ventas por $Y en los ultimos 30 dias"

### Para nosotros (plataforma)
- Saber exactamente cuantas ventas genera cada agente IA en cada canal
- Tener datos reales para pricing, retention, y upsell
- Poder decirle al cliente: "Tu agente IA genero $X en ventas este mes"

---

## ARQUITECTURA DE ATRIBUCION POR CANAL

```
WHATSAPP (atribucion directa por telefono):
  Cliente chatea con agente IA via WhatsApp (+5491112345678)
      ↓
  Agente asiste, envia productos, cierra venta
      ↓
  Cliente compra en Tienda Nube (deja telefono +5491112345678)
      ↓
  Sistema detecta orden nueva via polling/webhook
      ↓
  Cruza phone del comprador con customers.phone_number
      ↓
  Customer tiene conversaciones con agente IA → VENTA ATRIBUIDA ✓
      ↓
  ROI real actualizado en dashboard

FACEBOOK / INSTAGRAM (atribucion por tracking en links):
  Cliente chatea con agente IA via Messenger/Instagram DM
      ↓
  Agente envia link de producto con tracking:
    https://mitienda.com/producto-x?utm_source=nexus_ai
        &utm_medium=instagram
        &utm_campaign={conversation_id}
      ↓
  Cliente hace click → llega a Tienda Nube con UTM
      ↓
  Cliente compra → orden tiene landing_url con utm_campaign={conversation_id}
      ↓
  Sistema detecta orden nueva, parsea UTM del landing_url
      ↓
  Encuentra conversation_id en chat_conversations → VENTA ATRIBUIDA ✓

FALLBACK (atribucion por ventana de tiempo):
  Si no hay match por phone ni UTM:
      ↓
  Buscar si el email del comprador esta en customers
      ↓
  Si ese customer tuvo conversacion con agente en ultimas 48hs → ATRIBUCION PROBABLE
```

---

## SCOPE

### FASE 1 — Ventas reales de Tienda Nube en Dashboard

#### Backend: tiendanube_service

1. **Nuevo endpoint `POST /tools/orders_summary`**
   - Input: `store_id`, `access_token`, `date_from`, `date_to`, `status` (opcional)
   - Llama a `GET /v1/{store_id}/orders?created_at_min={date_from}&created_at_max={date_to}&per_page=200`
   - Pagina automaticamente si hay mas de 200 ordenes
   - Retorna resumen:
     ```json
     {
       "total_orders": 47,
       "total_revenue": 2115000.00,
       "currency": "ARS",
       "by_status": {
         "open": 3,
         "closed": 38,
         "cancelled": 4,
         "pending": 2
       },
       "by_payment_status": {
         "paid": 40,
         "pending": 5,
         "refunded": 2
       },
       "orders": [
         {
           "id": 123456,
           "number": "#1234",
           "created_at": "2026-03-15T10:30:00",
           "total": "45000.00",
           "currency": "ARS",
           "payment_status": "paid",
           "shipping_status": "shipped",
           "customer_phone": "+5491112345678",
           "customer_email": "cliente@email.com",
           "customer_name": "Juan Perez",
           "products": [{"name": "Remera XL", "quantity": 1, "price": "45000.00"}],
           "landing_url": "https://mitienda.com/producto?utm_source=nexus_ai&utm_campaign=abc123"
         }
       ]
     }
     ```

2. **Nuevo endpoint `POST /tools/orders_recent`**
   - Input: `store_id`, `access_token`, `limit` (default 10)
   - Retorna las ultimas N ordenes con detalle completo
   - Para mostrar en un feed de ventas recientes

#### Backend: orchestrator_service

3. **Nuevo endpoint `GET /admin/sales/dashboard`**
   - Requiere: usuario autenticado con Tienda Nube conectada
   - Usa `token_manager.get_valid_token()` para obtener access_token fresco
   - Llama a `tiendanube_service /tools/orders_summary`
   - Cache en Redis (TTL 300s, key: `sales:dashboard:{tenant_id}:{period}`)
   - Retorna:
     ```json
     {
       "period": "last_30_days",
       "total_orders": 47,
       "total_revenue": 2115000.00,
       "total_revenue_formatted": "$2.115.000",
       "currency": "ARS",
       "avg_ticket": 45000.00,
       "avg_ticket_formatted": "$45.000",
       "by_status": {...},
       "by_payment_status": {...},
       "recent_orders": [...],
       "tiendanube_connected": true
     }
     ```

4. **Nuevo endpoint `GET /admin/sales/orders`**
   - Lista paginada de ordenes con filtros (status, fecha, busqueda)
   - Para una futura vista de "Mis Pedidos"

5. **Modificar `GET /admin/stats`**
   - Agregar seccion `sales_metrics` al response existente:
     ```json
     {
       "roi_metrics": { ... },
       "assist_metrics": { ... },
       "sales_metrics": {
         "total_orders_30d": 47,
         "total_revenue_30d": 2115000.00,
         "total_revenue_formatted": "$2.115.000",
         "orders_today": 3,
         "revenue_today": 135000.00,
         "tiendanube_connected": true
       }
     }
     ```

#### Frontend: Dashboard

6. **Reemplazar hero de GMV heuristico por ventas reales** (cuando TN esta conectada)
   - Si `tiendanube_connected == true`:
     - Mostrar ventas reales: monto total, cantidad de pedidos, ticket promedio
     - Badge: "LIVE DATA — Tienda Nube"
   - Si `tiendanube_connected == false`:
     - Mantener heuristica actual con disclaimer
     - CTA: "Conecta Tienda Nube para ver ventas reales"

7. **Nuevo card "Ventas Recientes"**
   - Lista de ultimas 5 ventas con: numero de orden, monto, estado, fecha
   - Estado con color: verde (paid), amarillo (pending), rojo (cancelled)
   - Click → abre orden en Tienda Nube (link externo)

8. **Nuevo card "Ventas por Estado"**
   - Mini donut chart o barras: paid / pending / cancelled / refunded
   - Numeros al lado de cada estado

---

### FASE 2 — Atribucion de Ventas por WhatsApp (Match por Telefono)

#### Backend: orchestrator_service

9. **Nueva tabla `attributed_sales`**
   ```sql
   CREATE TABLE IF NOT EXISTS attributed_sales (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       tenant_id INTEGER NOT NULL REFERENCES tenants(id),
       order_id VARCHAR(64) NOT NULL,
       order_number VARCHAR(32),
       order_total DECIMAL(12,2),
       order_currency VARCHAR(8) DEFAULT 'ARS',
       order_status VARCHAR(32),
       payment_status VARCHAR(32),
       order_created_at TIMESTAMPTZ,
       customer_phone VARCHAR(32),
       customer_email VARCHAR(128),
       customer_name VARCHAR(128),
       -- Attribution fields
       conversation_id UUID REFERENCES chat_conversations(id),
       customer_id UUID,
       channel_source VARCHAR(32),
       attribution_method VARCHAR(32) NOT NULL,
           -- 'phone_match', 'utm_tracking', 'email_match', 'manual'
       attribution_confidence FLOAT DEFAULT 1.0,
           -- 1.0 = phone exact match
           -- 0.9 = utm_campaign match
           -- 0.5 = email + time window match
       attribution_details JSONB DEFAULT '{}',
       -- Timestamps
       attributed_at TIMESTAMPTZ DEFAULT NOW(),
       created_at TIMESTAMPTZ DEFAULT NOW(),
       -- Prevent duplicates
       UNIQUE(tenant_id, order_id)
   );

   CREATE INDEX idx_attributed_sales_tenant ON attributed_sales(tenant_id);
   CREATE INDEX idx_attributed_sales_conversation ON attributed_sales(conversation_id);
   CREATE INDEX idx_attributed_sales_created ON attributed_sales(order_created_at);
   ```

10. **Nuevo servicio `SalesAttributionService`**
    - Ubicacion: `orchestrator_service/app/services/sales_attribution.py`
    - Metodo principal: `attribute_order(tenant_id, order_data) -> AttributionResult`
    - Logica de atribucion (en orden de prioridad):
      1. **Phone match**: normalizar telefono del comprador, buscar en `customers` por `phone_number` del mismo tenant. Si existe y tiene conversaciones con agente en ultimos 7 dias → `attribution_method='phone_match'`, `confidence=1.0`
      2. **UTM match**: parsear `landing_url` de la orden, extraer `utm_campaign`. Si es un UUID valido, buscar en `chat_conversations` → `attribution_method='utm_tracking'`, `confidence=0.9`
      3. **Email match**: buscar email del comprador en `customers`. Si tiene conversaciones en ultimas 48hs → `attribution_method='email_match'`, `confidence=0.5`
      4. Si no hay match → no se atribuye (la orden se guarda igual para metricas generales)

11. **Nuevo job `sync_orders_and_attribute`**
    - Corre cada 10 minutos via asyncio task (similar a otros jobs existentes)
    - Para cada tenant con Tienda Nube conectada:
      1. Obtener token valido via `token_manager`
      2. Fetch ordenes de las ultimas 24hs via `tiendanube_service`
      3. Para cada orden nueva (no vista antes):
         - Guardar en `attributed_sales` (sin atribucion aun si no matchea)
         - Ejecutar `SalesAttributionService.attribute_order()`
         - Si se atribuye → actualizar `attributed_sales` con conversation_id, channel, method
      4. Actualizar cache de metricas

12. **Normalizacion de telefonos**
    - Funcion `normalize_phone(phone: str) -> str`
    - Maneja variantes: +54 9 11 1234-5678, 011-1234-5678, 5491112345678
    - Normaliza a formato E.164: +5491112345678
    - Se usa tanto al guardar customers como al comparar con ordenes de TN

#### Frontend: Dashboard

13. **Actualizar hero de ventas con atribucion**
    - Mostrar dos numeros:
      - "Ventas totales: $2.115.000 (47 pedidos)"
      - "Atribuidas al agente IA: $945.000 (21 pedidos)" ← highlight, color verde
    - Porcentaje: "El agente IA influyo en el 44.7% de tus ventas"

14. **Breakdown por canal en card de atribucion**
    ```
    Ventas atribuidas al agente IA (ultimos 30 dias)
    ─────────────────────────────────────────────────
    WhatsApp    │ 15 ventas │ $675.000 │ ████████████░░ 71%
    Instagram   │  4 ventas │ $180.000 │ ████░░░░░░░░░░ 19%
    Facebook    │  2 ventas │  $90.000 │ ██░░░░░░░░░░░░ 10%
    ─────────────────────────────────────────────────
    Total       │ 21 ventas │ $945.000 │ 100%
    ```

---

### FASE 3 — Tracking Links para Facebook e Instagram

#### Backend: orchestrator_service

15. **Nuevo modulo `link_tracker.py`**
    - Ubicacion: `orchestrator_service/app/services/link_tracker.py`
    - Funcion principal:
      ```python
      def inject_tracking(
          url: str,
          conversation_id: str,
          channel: str,  # 'facebook' | 'instagram'
          tenant_id: int
      ) -> str:
          """
          Inyecta UTM params en un link de producto de Tienda Nube.

          Input:  https://mitienda.mitiendanube.com/producto-genial
          Output: https://mitienda.mitiendanube.com/producto-genial
                    ?utm_source=nexus_ai
                    &utm_medium=instagram
                    &utm_campaign={conversation_id}
                    &utm_content={tenant_id}
          """
      ```
    - Reglas:
      - Solo inyectar en URLs que son de Tienda Nube (dominio `*.mitiendanube.com` o `*.nuvemshop.com.br`)
      - Si la URL ya tiene query params, appendear con `&`
      - No modificar URLs de otros dominios
      - Preservar la URL original — solo agregar params

16. **Modificar el flujo de respuesta del agente**
    - Ubicacion: donde el agente genera la respuesta antes de enviarla
    - Cuando `channel_source` es `facebook` o `instagram`:
      - Detectar URLs de Tienda Nube en el texto de respuesta (regex: `https?://[^\s]*(?:mitiendanube\.com|nuvemshop\.com\.br)[^\s]*`)
      - Para cada URL, aplicar `inject_tracking(url, conversation_id, channel, tenant_id)`
      - Reemplazar en el texto
    - Cuando `channel_source` es `whatsapp`:
      - NO inyectar tracking (la atribucion es por telefono, mas confiable)
      - Mantener URLs limpias

17. **Actualizar sales_template.py**
    - Agregar nota en el template: las URLs pueden tener parametros de tracking
    - El agente NO debe modificar ni remover parametros que ya esten en la URL
    - Actualizar la regla "URL CLEAN" por "URL ORIGINAL (puede incluir tracking params)"

#### Backend: SalesAttributionService

18. **Agregar UTM parsing al atribuidor**
    - En el metodo `attribute_order`:
      - Parsear `landing_url` de la orden de Tienda Nube
      - Extraer `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
      - Si `utm_source == 'nexus_ai'`:
        - `utm_campaign` = conversation_id → buscar en chat_conversations
        - `utm_medium` = canal de origen
        - Guardar en `attribution_details`: todos los UTM params
    - Nota: Tienda Nube guarda `landing_url` en ordenes en planes avanzados
      - Si no esta disponible, el tracking por UTM no funciona (fallback a phone/email)

---

### FASE 4 — Endpoints de ROI Real y Metricas de Atribucion

#### Backend: orchestrator_service

19. **Nuevo endpoint `GET /admin/roi/real`**
    - Reemplaza (o complementa) el heuristico actual
    - Retorna:
      ```json
      {
        "period": "last_30_days",
        "source": "tiendanube_live",
        "total_sales": {
          "orders": 47,
          "revenue": 2115000.00,
          "formatted": "$2.115.000"
        },
        "attributed_to_ai": {
          "orders": 21,
          "revenue": 945000.00,
          "formatted": "$945.000",
          "percentage": 44.68
        },
        "by_channel": {
          "whatsapp": {"orders": 15, "revenue": 675000.00, "method": "phone_match"},
          "instagram": {"orders": 4, "revenue": 180000.00, "method": "utm_tracking"},
          "facebook": {"orders": 2, "revenue": 90000.00, "method": "utm_tracking"}
        },
        "by_method": {
          "phone_match": {"orders": 15, "confidence": 1.0},
          "utm_tracking": {"orders": 5, "confidence": 0.9},
          "email_match": {"orders": 1, "confidence": 0.5}
        },
        "trend": {
          "vs_previous_period": "+12.3%",
          "attributed_growth": "+8.1%"
        }
      }
      ```

20. **Nuevo endpoint `GET /admin/roi/attributed-orders`**
    - Lista paginada de ordenes atribuidas al agente
    - Filtros: canal, metodo de atribucion, fecha, status
    - Cada orden muestra:
      - Datos de la orden (numero, monto, fecha, status)
      - Datos de la conversacion vinculada (preview, canal, customer)
      - Metodo de atribucion y confidence

21. **Modificar `GET /admin/stats` (update final)**
    - El `roi_metrics` ahora prioriza datos reales:
      ```json
      {
        "roi_metrics": {
          "source": "tiendanube_live",
          "total_gmv": 2115000.00,
          "attributed_gmv": 945000.00,
          "formatted_total": "$2.115.000",
          "formatted_attributed": "$945.000",
          "attributed_orders": 21,
          "total_orders": 47,
          "attribution_rate": 44.68,
          "top_channel": "whatsapp"
        }
      }
      ```
    - Si TN no esta conectada, fallback a heuristica con `"source": "heuristic"`

#### Frontend

22. **Reemplazar RoiTicker por RoiDashboard**
    - Componente mas completo que el ticker actual
    - Modo "live": datos de TN
    - Modo "heuristic": fallback actual
    - Animacion de transicion cuando TN se conecta por primera vez

23. **Nueva vista `/analytics/roi`** (o tab en Analytics)
    - Grafico de linea: ventas totales vs atribuidas (30 dias)
    - Breakdown por canal (pie chart)
    - Tabla de ordenes atribuidas con link a conversacion
    - Filtros: periodo, canal, metodo de atribucion

---

## MODELO DE DATOS — RESUMEN

```
tenants
  └─ credentials (TIENDANUBE_ACCESS_TOKEN, TIENDANUBE_USER_ID)
  └─ customers
  │    ├─ phone_number (match con ordenes WhatsApp)
  │    ├─ instagram_psid
  │    ├─ facebook_psid
  │    └─ email (match secundario)
  └─ chat_conversations
  │    ├─ customer_id → customers.id
  │    ├─ channel_source (whatsapp/facebook/instagram)
  │    └─ id (usado como utm_campaign en links)
  └─ attributed_sales [NUEVA]
       ├─ order_id (de Tienda Nube)
       ├─ conversation_id → chat_conversations.id
       ├─ customer_id → customers.id
       ├─ channel_source
       ├─ attribution_method (phone_match/utm_tracking/email_match)
       └─ attribution_confidence (1.0 / 0.9 / 0.5)
```

---

## NORMALIZACION DE TELEFONOS

Critico para la atribucion por WhatsApp. Tienda Nube puede guardar telefonos en formatos variados.

```python
import re

def normalize_phone(phone: str) -> str:
    """
    Normaliza telefono argentino a formato E.164.
    +54 9 11 1234-5678 → +5491112345678
    011-1234-5678      → +5491112345678
    5491112345678      → +5491112345678
    15-1234-5678       → +5491112345678 (asume Buenos Aires)
    """
    digits = re.sub(r'[^\d]', '', phone)

    # Remover prefijo internacional si empieza con 54
    if digits.startswith('54'):
        digits = digits[2:]

    # Remover 9 de celular si esta
    if digits.startswith('9'):
        digits = digits[1:]

    # Remover 0 de codigo de area
    if digits.startswith('0'):
        digits = digits[1:]

    # Remover 15 de celular viejo
    if digits.startswith('15') and len(digits) == 10:
        digits = '11' + digits[2:]

    # Reconstruir E.164 argentino
    return f'+549{digits}'
```

Nota: esta normalizacion asume Argentina. Para multi-pais se necesitaria `phonenumbers` lib.

---

## CONFIGURACION REQUERIDA

### Variables de entorno (ya existentes)
- `TIENDANUBE_SERVICE_URL` — URL del servicio TN
- `INTERNAL_SECRET_KEY` — para llamadas inter-servicio

### Nuevas variables
- `ORDERS_SYNC_INTERVAL_MINUTES=10` — frecuencia de sync de ordenes
- `ATTRIBUTION_WINDOW_HOURS=168` — ventana de atribucion por phone (7 dias default)
- `ATTRIBUTION_EMAIL_WINDOW_HOURS=48` — ventana de atribucion por email
- `UTM_SOURCE_TAG=nexus_ai` — tag utm_source para links

---

## CONSIDERACIONES DE LA API DE TIENDA NUBE

### Rate Limits
- 2 requests/segundo por app
- 10,000 requests/dia por store
- El job de sync debe respetar estos limites

### Endpoints de ordenes relevantes
- `GET /v1/{store_id}/orders` — listar ordenes con filtros
  - `?created_at_min=` — fecha desde
  - `?created_at_max=` — fecha hasta
  - `?status=` — open, closed, cancelled
  - `?payment_status=` — paid, pending, refunded, voided
  - `?per_page=200` — maximo por pagina
  - `?page=` — paginacion
- `GET /v1/{store_id}/orders/{order_id}` — detalle de una orden
- La orden incluye:
  - `customer.phone` — telefono del comprador
  - `customer.email` — email
  - `landing_url` — URL de aterrizaje (si disponible)
  - `total` — monto total
  - `currency` — moneda
  - `payment_status` — estado de pago
  - `status` — estado general
  - `products` — array de productos

---

## CRITERIOS DE ACEPTACION

### Fase 1 — Ventas en Dashboard
- [ ] Usuario con TN conectada ve ventas reales (monto, cantidad, estados) en dashboard
- [ ] Datos se refrescan cada 5 minutos (cache Redis)
- [ ] Si TN no esta conectada, muestra heuristica actual + CTA para conectar
- [ ] Card de ventas recientes muestra ultimas 5 ordenes con estado
- [ ] Endpoint `/admin/sales/dashboard` retorna datos correctos

### Fase 2 — Atribucion WhatsApp
- [ ] Tabla `attributed_sales` creada y migracion aplicada
- [ ] Job de sync corre cada 10 min para tenants con TN
- [ ] Orden con phone +5491112345678 se atribuye si customer con ese phone chateo con agente en ultimos 7 dias
- [ ] Dashboard muestra ventas totales vs atribuidas al agente
- [ ] Breakdown por canal visible en dashboard

### Fase 3 — Tracking Links FB/IG
- [ ] Links de TN enviados en Facebook/Instagram tienen UTM params inyectados
- [ ] Links de WhatsApp NO se modifican
- [ ] UTM params: utm_source=nexus_ai, utm_medium={channel}, utm_campaign={conversation_id}
- [ ] Ordenes con landing_url que contiene utm_campaign se atribuyen correctamente
- [ ] Sales template actualizado para aceptar URLs con params

### Fase 4 — ROI Real
- [ ] Endpoint `/admin/roi/real` retorna datos de atribucion completos
- [ ] Dashboard muestra ROI real cuando TN esta conectada
- [ ] Vista de analytics de ROI con graficos y tabla de ordenes atribuidas
- [ ] Fallback a heuristica cuando TN no esta conectada

---

## RIESGOS Y MITIGACIONES

| Riesgo | Mitigacion |
|--------|------------|
| Rate limit de TN API con muchos tenants | Sync escalonado: no todos los tenants al mismo tiempo. Cola con delay entre cada uno |
| Telefono del comprador no matchea por formato | Normalizacion agresiva de phones. Log de intentos fallidos para mejorar |
| landing_url no disponible en TN (plan basico) | UTM tracking es best-effort. WhatsApp phone match es el metodo principal |
| Ordenes duplicadas en sync | UNIQUE constraint en (tenant_id, order_id). Upsert, no insert |
| Token de TN expira durante sync | token_manager ya maneja auto-refresh. Retry una vez despues de refresh |
| Volumen alto de ordenes en tiendas grandes | Paginacion, solo ordenes de ultimas 24hs por sync. Sync completo solo la primera vez |

---

## PLAN DE IMPLEMENTACION

### Orden de ejecucion recomendado

```
Semana 1: FASE 1 — Ventas en Dashboard
├── Dia 1-2: Backend TN service (orders_summary endpoint)
├── Dia 2-3: Backend orchestrator (sales/dashboard endpoint, modificar stats)
└── Dia 3-5: Frontend (reemplazar hero GMV, cards de ventas)

Semana 2: FASE 2 — Atribucion WhatsApp
├── Dia 1: Migracion DB (tabla attributed_sales)
├── Dia 1-2: normalize_phone() + SalesAttributionService
├── Dia 2-3: Job sync_orders_and_attribute
├── Dia 3-4: Endpoints de ROI real
└── Dia 4-5: Frontend (metricas de atribucion en dashboard)

Semana 3: FASE 3 — Tracking Links FB/IG
├── Dia 1: link_tracker.py (inject_tracking)
├── Dia 1-2: Interceptor de respuestas para FB/IG
├── Dia 2: UTM parsing en SalesAttributionService
├── Dia 3: Actualizar sales_template.py
└── Dia 3-4: Testing end-to-end

Semana 4: FASE 4 — ROI Dashboard Final
├── Dia 1-2: Endpoint /admin/roi/real completo
├── Dia 2-3: Vista /analytics/roi
├── Dia 3-4: Polish, edge cases, testing
└── Dia 5: Deploy + monitoreo
```

---

## ARCHIVOS A MODIFICAR / CREAR

### Nuevos archivos
- `orchestrator_service/app/services/sales_attribution.py` — servicio de atribucion
- `orchestrator_service/app/services/link_tracker.py` — inyeccion de UTM en links
- `orchestrator_service/app/models/attributed_sale.py` — modelo SQLAlchemy
- `frontend_react/src/components/SalesDashboard.tsx` — componente de ventas
- `frontend_react/src/components/RoiReal.tsx` — reemplazo de RoiTicker
- `frontend_react/src/views/RoiAnalytics.tsx` — vista de analytics de ROI

### Archivos a modificar
- `tiendanube_service/main.py` — nuevo endpoint orders_summary
- `orchestrator_service/admin_routes.py` — nuevos endpoints sales + roi + modificar stats
- `orchestrator_service/main.py` — job de sync de ordenes + migracion DB
- `orchestrator_service/app/core/engine.py` — interceptar respuestas para tracking links
- `orchestrator_service/sales_template.py` — actualizar regla de URLs
- `frontend_react/src/views/Dashboard.tsx` — integrar nuevos componentes
- `frontend_react/src/views/Analytics.tsx` — agregar tab/seccion de ROI
- `frontend_react/src/components/RoiTicker.tsx` — deprecar o adaptar

# ⚒️ The Business Forge (Logic Deep Dive)

Este documento detalla la lógica de `BusinessForge.tsx`, el centro de comando post-ignición donde los usuarios refinan y utilizan los activos generados por la Magia.

---

## 🏗️ Arquitectura del Refinamiento

La Forge no es solo un visor; es un **Estudio de Fusión** que permite combinar datos crudos (productos) con identidad de marca (ADN) para crear nuevos activos bajo demanda.

### Componentes Clave
1.  **Tab System**: Separación lógica entre "Canvas" (Activos generados) y "Smart Catalog" (Productos brutos).
2.  **Asset Renderer (`AssetCard`)**: Renderizador polimórfico que cambia su UI según si el activo es Texto, JSON (Branding) o Visual.
3.  **Fusion Engine (`handleFusion`)**: El puente hacia la generación de imágenes bajo demanda.

---

## 🔄 Flujo de Datos

### 1. Carga de Activos (The Canvas)
-   **Endpoint**: `GET /admin/assets`
-   **Filtros Frontend**:
    -   `branding`: Muestra el ADN (Misión, Visión, Voz).
    -   `scripts`: Muestra los copys de venta (AIDA, PAS).
    -   `roi`: Muestra las proyecciones financieras.
    -   `visuals`: Muestra las imágenes generadas.
-   **Lógica de Renderizado**:
    -   Si `type === 'visuals'`, itera sobre `content.social_posts` y renderiza componentes interactivos `FusionItem`.
    -   Si es otro tipo, muestra un JSON pretty-print o texto.

### 2. Catálogo Inteligente (Smart Catalog)
-   **Endpoint**: `GET /admin/products`
-   **Propósito**: Permite seleccionar productos que *no* fueron procesados automáticamente en la fase de Magia inicial y generar anuncios para ellos manualmente.
-   **Filtro**: Por categoría (extraído dinámicamente del array de productos).

### 3. Motor de Fusión (Fusion Engine)
La funcionalidad estrella "Ignite Fusion" permite crear imágenes publicitarias al vuelo.
-   **Trigger**: Botón en `ProductCard` o `FusionItem`.
-   **Request**: `POST /admin/generate-image`
-   **Payload**:
    ```json
    {
      "prompt": "Professional advertising shot of [Product Name]...",
      "image_url": "https://tiendanube.../image.jpg"
    }
    ```
-   **Backend Logic**:
    1.  Descarga la imagen del producto.
    2.  Llama a Google Imagen 3 / Gemini Vision.
    3.  Devuelve una URL de la imagen generada.
-   **Visualización**: El componente `FusionItem` cambia a modo "Split View", permitiendo alternar entre "AI Re-Creation" (Imagen pura) y "Product Overlay" (Producto real superpuesto sobre fondo IA).

---

## 🎨 Modos de Visualización

### Reality vs Dream
La Forge implementa un selector único en los items visuales:
-   **Dream Mode**: Muestra la imagen tal cual salió del modelo generativo (puede alucinar detalles del producto).
-   **Reality Mode (Overlay)**: Técnica de composición frontend.
    -   Toma el fondo generado por la IA.
    -   Superpone la imagen *original* del producto (recortada/PNG) usando CSS absoluto y `mix-blend-overlay`.
    -   **Resultado**: Iluminación realista sobre el producto real, garantizando fidelidad de venta.

---

## 💾 Persistencia

-   **Lectura**: Tabla `business_assets`.
-   **Escritura**: Los nuevos assets generados por "Fusion" se guardan como nuevos registros en `business_assets` con `type: visuals`.

---

## 🔬 Especificaciones Técnicas (Debugging Guide)

### 1. Estados Críticos
| Estado | Tipo | Descripción | Error Común |
| :--- | :--- | :--- | :--- |
| `assets` | `Asset[]` | Datos del Canvas. | Si está vacío tras la ignición mágica, revisar si falló `ignite()`. |
| `products` | `Product[]` | Datos del Catálogo. | Si está vacío, revisar conexión con Tienda Nube. |
| `generating` | `boolean` | Bloqueo de UI. | Si se queda en `true` permanentemente, la promesa de `fetchApi` nunca resolvió (timeout). |

### 2. Endpoints & Payloads

#### A. Generar Imagen (Fusión)
*   **Request**: `POST /api/admin/generate-image`
*   **Body**:
    ```json
    {
      "prompt": "Foto de producto de lujo...",
      "image_url": "https://d3ugyf2ht6aenh.cloudfront.net/..."
    }
    ```
*   **Response (Success)**: `{ "status": "success", "url": "https://storage.googleapis.com/..." }`
*   **Response (Error)**: `{ "status": "error", "message": "Google Imagen API quota exceeded" }`

#### B. Cargar Productos (Context Bridge)
*   **Request**: `GET /api/admin/products`
*   **Backend Logic**:
    -   Busca el `tiendanube_access_token` del tenant actual.
    -   Llama a la API de Tienda Nube (`/v1/{store_id}/products`).
    -   Normaliza el JSON complejo de TN a una estructura simple `Product[]`.
    -   **Punto de Falla**: Si el token de Tienda Nube expiró, este endpoint devuelve 401.

### 3. Debugging Visual (Frontend)
El componente `FusionItem` tiene lógica compleja de capas.
*   **Problema**: "No veo la imagen generada, solo negro".
    *   **Causa**: La URL devuelta por el backend no es accesible por CORS o es http (insegura).
*   **Problema**: "El Overlay del producto no coincide".
    *   **Causa**: La imagen original (`base_image`) tiene fondo blanco en lugar de transparente. El modo `reality` requiere PNGs con transparencia para funcionar perfecto.


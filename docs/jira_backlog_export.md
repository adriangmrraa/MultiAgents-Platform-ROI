# Jira Backlog Completo - Proyecto "Fábrica de Negocios Autónoma"

**Formato:** Scrum Standard
**Objetivo:** Guía de desarrollo desde "Cero" hasta "MVP Comercial".
**Criterio de Calidad:** "Cero Ambigüedad" y "Lenguaje Claro".

---

## 🚀 SPRINT 1: Cimientos y Conexión (Semanas 1-2)
**Objetivo de Negocio:** Lograr que el sistema "exista" y pueda leer los productos de la   tienda automáticamente.

### ÉPICA 1: Infraestructura Base
#### Historia 1.1: Entorno de Trabajo Estable
*   **Como** Desarrollador, **quiero** poder trabajar en mi PC con la misma configuración que el servidor real **para** no perder tiempo arreglando errores de instalación.
*   **Criterios de Aceptación:**
    *   [ ] Al ejecutar un solo comando (`docker-compose up`), se inician los 4 servicios necesarios (API, Base de Datos, Memoria Caché, Procesador en 2do plano).
    *   [ ] El sistema responde "OK" en la dirección de prueba `/health`.

#### Historia 1.2: Base de Datos de Clientes
*   **Como** Arquitecto del Sistema, **quiero** tener las "carpetas" (tablas) listas **para** guardar la información de las tiendas y sus claves de forma segura.
*   **Criterios de Aceptación:**
    *   [ ] La base de datos se crea automáticamente con las tablas: `tenants` (tiendas), `credentials` (claves), `customers` (clientes finales).
    *   [ ] Las contraseñas y claves API se guardan encriptadas (ilegibles para humanos).

### ÉPICA 2: Carga de Datos (Ingesta)
#### Historia 2.1: Conexión con Tienda Nube
*   **Como** Dueño de Tienda, **quiero** conectar mi tienda con un clic **para** dar permiso al sistema de leer mis productos.
*   **Criterios de Aceptación:**
    *   [ ] El botón "Conectar" redirige a Tienda Nube y devuelve un permiso válido (Token).
    *   [ ] El permiso se guarda automáticamente en la base de datos de la tienda correspondiente.

#### Historia 2.2: Descarga Automática de Productos
*   **Como** Sistema, **quiero** descargar el catálogo completo de la tienda **para** que los agentes sepan qué vender.
*   **Criterios de Aceptación:**
    *   [ ] El sistema descarga: Nombre, Precio, Stock, Fotos y Descripción de todos los productos.
    *   [ ] Si cambia un precio en Tienda Nube, el sistema se entera y actualiza su base de datos en menos de 5 segundos.

---

## 🧠 SPRINT 2: Cerebro y Memoria (Semanas 3-4)
**Objetivo de Negocio:** Que el bot pueda responder preguntas básicas sobre los productos descargados.

### ÉPICA 3: Chat Inteligente
#### Historia 3.1: Búsqueda de Productos por "Significado"
*   **Como** Comprador, **quiero** buscar "algo para correr" y ver zapatillas de running **para** encontrar lo que busco sin saber el nombre exacto.
*   **Criterios de Aceptación:**
    *   [ ] El sistema encuentra productos relacionados conceptualmente (ej. "frío" -> "campera"), no solo por coincidencia de palabras exacta.
    *   [ ] La búsqueda tarda menos de 0.3 segundos.

#### Historia 3.2: Chat Fluido en Tiempo Real
*   **Como** Usuario, **quiero** ver cómo el bot escribe la respuesta palabra por palabra **para** sentir que estoy hablando con alguien ágil y no esperar a un bloque de texto.
*   **Criterios de Aceptación:**
    *   [ ] La respuesta aparece progresivamente en la pantalla (efecto máquina de escribir).
    *   [ ] El bot tarda menos de 2 segundos en empezar a escribir.

---

## 🛠️ SPRINT 3: Agentes Vendedores y Soporte (Semanas 5-6)
**Objetivo de Negocio:** Que el bot sepa diferenciar si le quieren comprar o si tienen un problema.

### ÉPICA 4: Especialización de Agentes
#### Historia 4.1: Clasificador de Intención
*   **Como** Sistema, **quiero** entender si el usuario quiere comprar o reclamar **para** derivarlo al agente experto en ese tema.
*   **Criterios de Aceptación:**
    *   [ ] El sistema distingue correctamente entre: "Quiero comprar", "Dónde está mi pedido" y "Quiero hablar con un humano".
    *   [ ] Si es compra, activa al Vendedor. Si es reclamo, activa al Soporte.

#### Historia 4.2: Agente Vendedor Persuasivo
*   **Como** Dueño, **quiero** un agente que priorice vender lo que tengo en stock **para** aumentar mi facturación.
*   **Criterios de Aceptación:**
    *   [ ] El agente siempre verifica que haya stock antes de recomendar.
    *   [ ] Antes de terminar la venta, ofrece un segundo producto relacionado ("¿Llevas medias con esas zapatillas?").

#### Historia 4.3: Agente de Soporte (Rastreo de Pedidos)
*   **Como** Cliente Ansioso, **quiero** saber el estado exacto de mi paquete **para** quedarme tranquilo.
*   **Criterios de Aceptación:**
    *   [ ] El agente pide el número de orden si no lo tiene.
    *   [ ] El agente consulta a Tienda Nube y responde con el estado real ("En camino", "Empaquetado").

---

## 🔮 SPRINT 4: La Fábrica de Estrategia "Magic Onboarding" (Semanas 7-8)
**Objetivo de Negocio:** Configuración automática de la "Personalidad" y "Estrategia" de la marca en 60 segundos.

### ÉPICA 5: Los 7 Agentes Estratégicos
#### Historia 5.1: Extractor de Identidad de Marca
*   **Como** Nuevo Cliente, **quiero** ingresar mi sitio web y que la IA entienda mi marca sola **para** no llenar formularios largos.
*   **Criterios de Aceptación:**
    *   [ ] El sistema lee la página "Quiénes Somos" y la Home.
    *   [ ] Detecta y guarda automáticamente: Tono de Voz (ej. "Juvenil"), Arquetipo (ej. "Explorador") y Propuesta de Valor.

#### Historia 5.2: Generador de Estrategia de Contenidos
*   **Como** Dueño, **quiero** que la IA me proponga qué publicar en redes la próxima semana **para** mantener mi audiencia activa sin esfuerzo.
*   **Criterios de Aceptación:**
    *   [ ] El sistema genera un calendario (Lunes a Viernes) con ideas de posts coherentes con la marca.
    *   [ ] Incluye los textos (captions) redactados con el Tono de Voz detectado.

#### Historia 5.3: Auditor de Calidad (Compliance)
*   **Como** Sistema, **quiero** revisar que lo que inventó la IA sea verdad **para** no mentirle a los clientes sobre precios o productos.
*   **Criterios de Aceptación:**
    *   [ ] El sistema bloquea cualquier publicación que mencione un producto que no existe en el catálogo.
    *   [ ] Verifica que el precio mencionado sea el precio real actual.

---

## 🎨 SPRINT 5: Creación de Imágenes Publicitarias (Semanas 9-10)
**Objetivo de Negocio:** Que la IA pueda "photoshopear" productos para crear anuncios atractivos.

### ÉPICA 6: Motor Creativo Visual
#### Historia 6.1: Recorte de Producto
*   **Como** Agente Creativo, **quiero** quitarle el fondo feo a la foto del producto **para** ponerlo en un mejor escenario.
*   **Criterios de Aceptación:**
    *   [ ] El sistema toma la foto original y devuelve una imagen del producto con fondo transparente (PNG).

#### Historia 6.2: Generación de Ambiente Publicitario
*   **Como** Agente Creativo, **quiero** generar un fondo que represente el estilo de la marca **para** que el producto luzca profesional.
*   **Criterios de Aceptación:**
    *   [ ] Si la marca es "Aventura", genera un fondo de montaña/bosque.
    *   [ ] La imagen final muestra el producto integrado naturalmente en el nuevo fondo generado, sin deformarse.

---

## 🌐 SPRINT 6: Conexión Omnicanal (Semanas 11-12)
**Objetivo de Negocio:** Activar el sistema en WhatsApp e Instagram reales.

### ÉPICA 7: Mensajería 
#### Historia 7.1: WhatsApp Automático
*   **Como** Negocio, **quiero** que el bot conteste mi WhatsApp oficial **para** no perder ventas fuera de horario.
*   **Criterios de Aceptación:**
    *   [ ] El bot responde mensajes de texto y notas de voz en WhatsApp.
    *   [ ] Puede enviar las imágenes publicitarias generadas directamente al chat.

#### Historia 7.2: Pase a Humano (Botón de Pánico)
*   **Como** Vendedor Humano, **quiero** poder intervenir si la IA se traba **para** salvar la venta.
*   **Criterios de Aceptación:**
    *   [ ] Si el humano manda un mensaje, el bot se apaga automáticamente por 24hs en esa conversación.
    *   [ ] El sistema avisa por email si un cliente pide hablar con un asesor.

---

## 📊 SPRINT 7: Panel de Control y Lanzamiento (Semanas 13-14)
**Objetivo de Negocio:** Entregar la herramienta al usuario final para que vea resultados.

### ÉPICA 8: Panel de Usuario
#### Historia 8.1: Visor del Proceso "Mágico"
*   **Como** Usuario, **quiero** ver una barra de progreso mientras se crea mi estrategia **para** entender que la IA está trabajando.
*   **Criterios de Aceptación:**
    *   [ ] Pantalla que muestra paso a paso: "Analizando Marca...", "Generando Ideas...", "Diseñando Anuncios...".

#### Historia 8.2: Reporte de Resultados (ROI)
*   **Como** Dueño, **quiero** ver cuánta plata me generó la IA **para** saber si vale la pena pagarla.
*   **Criterios de Aceptación:**
    *   [ ] Gráfico claro comparando: Ventas totales vs. Ventas donde intervino la IA.

### ÉPICA 9: Seguridad Final
#### Historia 9.1: Protección de Datos
*   **Como** Responsable Técnico, **quiero** asegurar que nadie pueda robar los datos de mis clientes **para** evitar problemas legales.
*   **Criterios de Aceptación:**
    *   [ ] Nadie puede acceder a la información de una tienda sin su contraseña específica.
    *   [ ] Auditoría de seguridad aprobada (sin vulnerabilidades críticas).

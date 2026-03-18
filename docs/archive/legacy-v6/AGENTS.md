# 🦍 Guía de Inteligencia Soberana (Nexus v5.1)

Este documento detalla la arquitectura de **IA Soberana** de la plataforma. En la v5.1, la inteligencia deja de ser compartida para ser **estrictamente privada**, donde cada agente opera bajo el contexto de las credenciales del inquilino.

---

## Parte I: Agentes Conversacionales (Runtime Soberano)

Ubicación: `agent_service/` (Cerebro Apátrida)

El **Agent Service** procesa chats en tiempo real. En la v5.1, su "combustible" es dinámico:

### 1. Inyección de Credenciales Soberanas
Cada ejecución de un agente (`POST /v1/agent/execute`) ahora recibe las llaves descifradas desde la Bóveda del Orquestador:

*   **Sovereign OpenAI Key**: El agente usa la API Key propia del cliente para sus pensamientos, eliminando cuellos de botella de cuota global.
*   **Sovereign TiendaNube Token**: Las herramientas de búsqueda (`search_specific_products`, etc.) usan el token privado de la tienda en lugar de variables globales.

#### Contexto Aislado (ContextVars)
Usamos `contextvars` para asegurar que, en un servidor con miles de peticiones simultáneas, las llaves de un Inquilino A nunca se mezclen con las del Inquilino B:

```python
# Aislamiento de llaves en tiempo de ejecución
ctx_openai_key: ContextVar[str] = ContextVar("ctx_openai_key")
ctx_google_key: ContextVar[str] = ContextVar("ctx_google_key")
```

---

> **Nota Técnica**: Este documento explica la arquitectura conceptual.
> *   Para detalles sobre cómo **Configurar** agentes en el Admin, ver: [Agents Logic Deep Dive](AGENTS_LOGIC_DEEP_DIVE.md).
> *   Para detalles sobre la **Orquestación de los 7 Agentes** ("Magia"), ver: [Magic Logic Deep Dive](MAGIC_LOGIC_DEEP_DIVE.md).

---

## 1. Los "Siete Magníficos": Perfiles de Agentes

Nexus v5.1 orquesta siete especialistas que trabajan de forma coordinada, cada uno con acceso a la Bóveda de Credenciales del inquilino.

### 1.1 Extractor de ADN de Marca (The Profiler)
- **Rol**: Analiza la historia, valores y catálogo para definir la identidad.
- **Táctica**: Utiliza GPT-4o para destilar arquetipos de marca a partir de datos crudos.

### 1.2 Director Creativo de Performance (The Artist)
- **Rol**: El motor visual y estratégico de las campañas.
- **Táctica**: Fusiona **Google Gemini** (Visión) y **DALL-E 3 / Imagen 3** (Generación) usando las llaves del inquilino.

### 1.3 Copywriter Maestro (The Voice)
- **Rol**: Experto en redacción persuasiva.
- **Táctica**: Aplica frameworks de respuesta directa (Eugene Schwartz, AIDA) adaptados al tono de voz extraído.

### 1.4 Arquitecto de Crecimiento (The Strategist)
- **Rol**: Analista de negocio y proyecciones.
- **Táctica**: Proyecta escenarios de ROI, ROAS y CLV basados en precios del catálogo.

### 1.5 Social Media Specialist (The Amplifier)
- **Rol**: Adaptador de formatos y canales.
- **Táctica**: Traduce los activos creativos a especificaciones técnicas de Instagram, Facebook y WhatsApp.

### 1.6 Bibliotecario RAG (The Knowledge Keeper)
- **Rol**: Guardián del conocimiento específico de la tienda.
- **Táctica**: Gestiona la búsqueda vectorial en ChromaDB. Sus embeddings dependen de la **OpenAI Key** soberana.

### 1.7 Guardián de la Verdad (The Auditor)
- **Rol**: Filtro final de calidad y seguridad.
- **Táctica**: Verifica que no haya alucinaciones de precios o stock antes de la publicación.

---

## 2. El Ciclo de Pensamiento Soberano

Cuando un agente se activa, sigue este protocolo de seguridad:

1.  **Recuperación**: El orquestador solicita la llave (OpenAI/Google) a la `Bóveda` usando el `tenant_id`.
2.  **Inyección**: La llave se inyecta en el hilo de ejecución actual a través de `ContextVars` (`ctx_openai_key`).
3.  **Ejecución**: El agente realiza la inferencia. **IMPORTANTE**: La facturación y los límites de cuota recaen sobre la cuenta del inquilino, no de la plataforma.
4.  **Limpieza**: Al terminar, la llave se purga de la memoria volátil.

---

## 3. Desarrollo de Agentes (Sovereign Best Practices)

- **Aislamiento**: Nunca uses `os.getenv("OPENAI_API_KEY")` dentro de la lógica de un agente. Siempre recupera la llave desde el contexto o el modelo inyectado.
- **Eficiencia**: Usa el modelo más pequeño capaz de cumplir la tarea (GPT-4o-mini para clasificación, GPT-4o para síntesis creativa).
- **Herramientas**: Los agentes deben invocar herramientas utilizando el `X-Internal-Secret` para garantizar la trazabilidad mutua entre microservicios.

---

**© 2026 Platform AI Solutions - Sovereign Intelligence Division**

## Desarrollo de Herramientas (Sovereign Best Practices)

Al crear nuevas herramientas (`@tool`), siempre debes usar los `ContextVars` para obtener las credenciales:

```python
@tool
async def my_new_sovereign_tool(query: str):
    """Herramienta que respeta la soberanía del cliente."""
    api_key = ctx_openai_key.get() # Obtener llave del inquilino actual
    # ... ejecutar lógica ...
    return f"Respuesta generada con identidad {tenant_id}"
```

> [!WARNING]
> Nunca uses `os.getenv("OPENAI_API_KEY")` dentro de la lógica del agente. Esto rompería el Protocolo de Soberanía y usaría la llave global de la plataforma, causando fugas de costos.

---

**© 2026 Platform AI Solutions - Sovereign Intelligence Division**

# WIZARD_WIRING.md (El Manual del Wizard)

## Resumen
El **Dynamic Agent Wizard** es la interfaz que permite a los usuarios "programar" el cerebro de su agente sin tocar código. Traduce intenciones de negocio (texto natural) en configuraciones técnicas JSON que el `AgentTemplateFactory` consume.

## 1. Configuración Dinámica (Frontend-to-Backend)
El formulario se genera a partir de `AGENT_CONFIG_SCHEMA` en `DynamicAgentWizard.tsx`.

### Flujo de Datos
1.  **Input**: Usuario edita "Reglas de Negocio" en el textarea.
2.  **Mapping**: El frontend mapea este campo a `formData.business_rules`.
3.  **Submit**: Al guardar, se envía a `POST /admin/agents` (o PUT).
4.  **Persistencia**: El backend guarda un JSON en la columna `agents.config`:
    ```json
    {
      "tone": "...",
      "business_rules": "...",
      "synonym_dictionary": "...",
      "template_type": "sales"
    }
    ```
5.  **Hidratación**: Cuando el agente se ejecuta, `models.py` lee este JSON y lo pasa como `wizard_overrides` a la plantilla activa.

## 2. Mejora con IA (Magic Button)
El botón "Mejorar con IA" (Sparkles) invoca al endpoint `/admin/ai/improve-prompt`.

*   **Meta-Prompting**: El endpoint utiliza un prompt especializado para cada campo:
    *   *Tono*: "Convierte esto en una guía de estilo estructurada..."
    *   *Reglas*: "Detecta ambigüedades y reformatea estas reglas como una lista numerada estricta..."
    *   *Sinónimos*: "Genera variantes léxicas para estas categorías de e-commerce..."
*   **Safety**: Requiere una API Key de OpenAI válida configurada en el Tenant. Si falta, el Wizard muestra un error amigable.

## 3. Live Preview (Simulación en Tiempo Real)
El panel lateral de "Prueba en Vivo" permite iterar sin guardar.

### Arquitectura de Previsualización
*   **Estado Local**: El chat usa el estado React `formData` actual (lo que está escrito en los inputs en ese milisegundo).
*   **Transient Context**: No lee la base de datos.
*   **Endpoint**: `POST /admin/agents/simulate`
    *   Recibe: `message`, `formData`.
    *   Acción: Construye un `AgentConfig` volátil e invoca al `AgentService`.
    *   Resultado: El usuario ve cómo respondería el agente con las reglas que *acaba de escribir*, cerrando el ciclo de feedback a < 2 segundos.

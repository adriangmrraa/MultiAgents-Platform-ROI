# 🤖 Platform AI Solutions: Guía Suprema de Mantenimiento (Protocolo Omega)

**Versión 1.1 - 24 de Diciembre de 2025**
*Fuente Única de Verdad (Single Source of Truth) para el Ecosistema Platform AI Solutions*

## 🧱 Arquitectura Nexus v3 (Decentralized Intelligence)

El sistema ha evolucionado de un monolito a una arquitectura totalmente descentralizada. El núcleo ya no "piensa", sino que "coordina".
   
### 📡 Traffic Controller (orchestrator_service)
- **Rol**: Orquestación de datos, persistencia en PostgreSQL y gestión de estados.
- **Responsabilidad**: Recepción de webhooks (WhatsApp/YCloud), auditoría de seguridad y ruteo cognitivo.
- **Protocolo de Ruteo**: Delega el procesamiento de IA al `agent_service` mediante peticiones HTTP internas (`/v1/agent/execute`).
- **Estado**: Gestiona el historial y los metadatos de los tenants.

### 🧠 Cognitive Brain (agent_service)
- **Rol**: Razonamiento puro y ejecución de herramientas.
- **Responsabilidad**: Procesar entradas de usuario usando LangChain (GPT-4o-mini).
- **Statelessness**: Es un servicio 100% apátrida. Recibe TODO el contexto (prompts, catálogo, credenciales dinámicas) en cada petición.
- **Tools**: Ejecuta búsquedas en Tienda Nube usando las credenciales inyectadas por el orquestador bajo el **Protocolo Omega**.
- **Esquema de Respuesta**: El agente debe retornar un JSON con la estructura `{"messages": [{"text": "...", "metadata": {...}}]}`. Los metadatos son cruciales para alimentar el "Thinking Log" en el Dashboard.

---

## 🛡️ Protocolo Omega (Soberanía y Aislamiento)

Garantiza la soberanía de datos absoluta en un entorno multi-inquilino.

### 1. Inyección Dinámica de Credenciales
- Ningún servicio (excepto el orquestador) almacena API Keys de forma permanente.
- El orquestador resuelve el `tenant_id` y pasa las claves necesarias (Tienda Nube, OpenAI) al agente en tiempo de ejecución.
- **Seguridad**: La variable `ENCRYPTION_KEY` **DEBE** inyectarse en el entorno de EasyPanel. El uso del valor por defecto en producción se considera una falla crítica de seguridad.

### 2. Integridad y Borrado en Cascada
Para garantizar que no queden datos "huérfanos", la eliminación de un inquilino debe seguir este orden estricto:
1.  **Handoff Config**: `tenant_human_handoff_config`.
2.  **Conversaciones**: `chat_conversations` (dispara cascada a mensajes y media).
3.  **Credenciales**: `credentials` (específicos del tenant).
4.  **Entidad Raíz**: `tenants`.

---

## 📜 Reglas de Oro para Operación (Precauciones)

### 1. 🐍 Python (Backend)
- **LA TRAMPA DE PYDANTIC (CRÍTICO)**: Nunca definas un `BaseModel` dentro de una función asíncrona. Define siempre las clases al nivel superior del archivo para evitar errores de sintaxis en contenedores.
- **Comunicación Interna**: Usa siempre el DNS interno de Docker (ej. `http://agent_service:8001`). No expongas servicios cognitivos a la red pública.
- **Human Override**: El flag `human_override_until` debe ser la primera compuerta lógica. Si está activo, el orquestador **silencia** la comunicación con el agente.

### 2. 🚦 Intervención Humana (Handoff)
- **Trigger**: El agente activa el modo `HUMAN_HANDOFF_REQUESTED: <razon>`.
- **Acción**: El orquestador bloquea la IA (2099) y notifica vía SMTP configurado.
- **Status Dashboard**: 🔴 Rojo (Atención Humana) vs 🟢 Verde (IA Activa).

---

## 📈 Observabilidad y Diagnóstico
- **Logs**: Formato JSON en `stdout` para indexación en EasyPanel.
- **Correlation-ID**: Cada "burbuja" de mensaje debe rastrearse desde el webhook de entrada hasta la respuesta final.

---
**Recuerda**: La estabilidad del sistema depende de la adherencia estricta a la separación entre Coordinación (Orquestador) y Cognición (Agente).

# **Product Requirements Document (PRD)**

## **Proyecto: Nexus – Plataforma de Orquestación de Comercio Autónomo**

| Metadatos | Detalle |
| ----- | ----- |
| **Versión** | **2.1 – PRD Unificado (Sistema Real \+ Negocio)** |
| **Estado** | **Aprobado para Planificación y Descomposición Ágil** |
| **Audiencia** | **Product Managers, Product Owners, Stakeholders, Scrum Masters** |
| **Visión** | **Democratizar la IA Empresarial mediante un modelo de Soberanía de Datos y Costos** |

## ---

## **1\. Visión y Estrategia del Producto**

### **1.1 El Problema (The Gap)**

## **Los pequeños y medianos comercios (SMBs) enfrentan una Fricción de Escala estructural:**

* ## **Bloqueo Operativo: más ventas implican más personal humano.**

* ## **Silos de Datos: marketing, ventas y soporte viven en canales desconectados.**

* ## **Barrera de Entrada: la IA empresarial es costosa, opaca o requiere perfiles técnicos.**

* ## **ROI Invisible: la automatización rara vez se traduce en métricas financieras claras.**

### **1.2 La Solución: Fuerza Laboral Digital Autónoma**

## **Nexus no es un chatbot.**

## **Es una plataforma de orquestación de fuerza laboral digital, donde múltiples agentes autónomos, especializados y gobernables operan sobre:**

* ## **Inventario real**

* ## **Conocimiento del comercio**

* ## **Canales omnicanal**

## **Estos agentes pueden vender, soportar, calificar leads, generar marketing y auto-auditar su impacto financiero.**

### **1.3 Propuesta de Valor Diferencial (Soberanía)**

## **Nexus se construye sobre tres principios no negociables:**

* ## **Soberanía de Costos (BYOK): el comercio conecta sus propias credenciales de IA.**

* ## **Soberanía de Datos: el conocimiento del negocio es privado y aislado.**

* ## **Soberanía Operativa: el humano puede intervenir, auditar y apagar la IA en cualquier momento.**

## ---

## **2\. Perfiles de Usuario (Personas)**

| Perfil | Rol | Objetivo Principal | Dolor Principal |
| ----- | ----- | ----- | ----- |
| **Comerciante (Admin)** | **Dueño / Gerente** | **Automatizar ventas y reducir carga operativa** | **“No tengo tiempo para responder lo mismo 100 veces”** |
| **Operador Humano** | **Soporte / Ventas** | **Intervenir solo cuando agrega valor** | **“El chat está saturado de consultas triviales”** |
| **Comprador Final** | **Cliente** | **Comprar y resolver dudas sin fricción** | **“Odio esperar para saber si hay stock”** |

## ---

## **3\. Dominios Funcionales del Producto**

1. ## **Agent Orchestration Core (The Sovereign Brain)**

2. ## **Unified Commerce Knowledge Layer**

3. ## **Omnichannel Sovereign Routing**

4. ## **Human Governance & Safety Layer**

5. ## **Creative Automation Studio**

6. ## **ROI, Assist Score & Observability Engine**

7. ## **Sovereign Credential Vault (Security Core)**

8. ## **Integration & Onboarding Wizard (Magic Flow)**

9. ## **Automated Infrastructure & Reliability (Self-Healing)**

## ---

## **4\. Capacidades Diferenciales Derivadas del Sistema Real**

### **4.1 Arquitectura de Agentes Polimórficos**

## **El sistema opera con múltiples agentes especializados, instanciados dinámicamente:**

* ## **Sales Agent**

* ## **Support Agent**

* ## **Lead Qualification Agent**

* ## **Logistics / Postventa Agent**

## **Cada agente posee:**

* ## **Objetivos explícitos**

* ## **Límites de acción**

* ## **Métricas propias**

## ---

### **4.2 Assist Score (Auto-Auditoría Continua)**

## **Cada N turnos de conversación, el sistema:**

* ## **Evalúa si la interacción generó valor**

* ## **Clasifica el resultado (venta, soporte, abandono)**

* ## **Calcula ROI financiero estimado en tiempo real**

## **El ROI no es un dashboard, es un flujo operativo.**

## ---

### **4.3 Shadow RAG (Memoria Profunda)**

## **Además de documentos cargados manualmente, Nexus aprende pasivamente:**

* ## **Patrones de conversaciones exitosas**

* ## **Objeciones frecuentes**

* ## **Respuestas que derivan en conversión**

## **Este aprendizaje es:**

* ## **Implícito**

* ## **Aislado por comercio**

* ## **Gobernado por reglas**

## ---

### **4.4 Enrutamiento Omnicanal Soberano**

## **El sistema gobierna múltiples canales con:**

* ## **Triangular Routing: selección dinámica de agente/canal**

* ## **Atomic Buffer: protección anti-ráfagas**

* ## **Continuidad Cross-Canal: contexto persistente por cliente**

## ---

## **5\. Épicas y Historias de Usuario (Formato Scrum Completo)**

## **Todas las historias se expresan en formato Como / Quiero / Para, con reglas de negocio claras y criterios de aceptación verificables.**

## ---

### **ÉPICA 1 – Orquestación de Agentes Polimórficos**

## **Objetivo de negocio: Permitir que el comercio configure y gobierne una fuerza laboral digital especializada, escalable y segura.**

## **US-1.1 Crear agente por rol** **Como Comerciante Administrador,** **quiero crear agentes digitales asignándoles un rol específico (Ventas, Soporte, Leads, Logística),** **para que cada agente tenga objetivos claros y actúe de forma coherente con su función.**

## ***Criterios de aceptación:***

* ## **El usuario puede seleccionar un rol predefinido.**

* ## **Cada rol carga objetivos y límites por defecto.**

* ## **El agente queda operativo inmediatamente tras su creación.**

## ---

## **US-1.2 Editar identidad y comportamiento del agente** **Como Comerciante Administrador,** **quiero modificar el tono, objetivos y reglas de un agente existente,** **para adaptar su comportamiento sin necesidad de recrearlo.**

## ***Criterios de aceptación:***

* ## **Los cambios se aplican sin reiniciar conversaciones activas.**

* ## **El sistema valida coherencia de reglas antes de guardar.**

* ## **El historial del agente se conserva.**

## ---

## **US-1.3 Pausar y reanudar agente** **Como Operador Humano,** **quiero pausar o reanudar un agente en tiempo real,** **para evitar respuestas automáticas ante situaciones sensibles.**

## ***Criterios de aceptación:***

* ## **El agente deja de responder automáticamente al pausarse.**

* ## **El estado del agente es visible en todo momento.**

* ## **Al reanudarse, el agente retoma su rol asignado.**

## ---

### **ÉPICA 2 – Gestión de Estado Conversacional**

## **Objetivo de negocio: Garantizar continuidad, coherencia y memoria en todas las interacciones.**

## **US-2.1 Persistencia de contexto por cliente** **Como Sistema,** **quiero almacenar el historial de conversaciones de cada cliente,** **para responder de forma contextual y coherente en interacciones futuras.**

## ***Criterios de aceptación:***

* ## **El contexto se recupera automáticamente al iniciar una nueva conversación.**

* ## **El historial es único por cliente.**

* ## **El contexto no se mezcla entre comercios.**

## ---

## **US-2.2 Continuidad cross-canal** **Como Comprador Final,** **quiero continuar una conversación iniciada en un canal desde otro canal distinto,** **para no repetir información ni perder contexto.**

## ***Criterios de aceptación:***

* ## **El sistema reconoce al cliente independientemente del canal.**

* ## **El agente responde considerando interacciones previas.**

* ## **Se mantiene la coherencia del flujo conversacional.**

## ---

### **ÉPICA 3 – Knowledge Layer y Shadow RAG**

## **Objetivo de negocio: Asegurar que la IA siempre responda con información real, actualizada y aprendida.**

## **US-3.1 Sincronización de catálogo** **Como Sistema,** **quiero sincronizar productos, precios y stock del comercio,** **para evitar respuestas incorrectas o desactualizadas.**

## ***Criterios de aceptación:***

* ## **Los cambios de precio o stock se reflejan automáticamente.**

* ## **El agente solo responde con productos disponibles.**

* ## **El catálogo es exclusivo por comercio.**

## ---

## **US-3.2 Aprendizaje pasivo (Shadow RAG)** **Como Sistema,** **quiero aprender de conversaciones pasadas exitosas,** **para mejorar progresivamente la calidad de las respuestas.**

## ***Criterios de aceptación:***

* ## **Solo se almacenan patrones relevantes.**

* ## **El aprendizaje es invisible para el usuario final.**

* ## **No existe contaminación entre comercios.**

## ---

### **ÉPICA 4 – Orquestación Omnicanal Soberana**

## **Objetivo de negocio: Centralizar y gobernar todos los canales de comunicación.**

## **US-4.1 Bandeja omnicanal unificada** **Como Operador Humano,** **quiero visualizar todos los mensajes entrantes en una sola bandeja,** **para gestionarlos sin cambiar de herramienta.**

## ***Criterios de aceptación:***

* ## **Cada mensaje indica claramente su canal de origen.**

* ## **El historial se muestra por cliente.**

* ## **El operador puede responder manualmente.**

## ---

## **US-4.2 Protección anti-ráfagas** **Como Sistema,** **quiero regular picos de mensajes entrantes,** **para mantener una experiencia fluida para el usuario final.**

## ***Criterios de aceptación:***

* ## **Ningún mensaje se pierde.**

* ## **El tiempo de respuesta se mantiene estable.**

* ## **El orden conversacional se respeta.**

## ---

### **ÉPICA 5 – Gobierno Humano–IA**

## **Objetivo de negocio: Garantizar control humano total y mitigación de riesgos.**

## **US-5.1 Hand-off manual inmediato** **Como Operador Humano,** **quiero tomar control inmediato de una conversación,** **para resolver situaciones críticas personalmente.**

## ***Criterios de aceptación:***

* ## **El bot se silencia automáticamente.**

* ## **El cliente recibe confirmación visual.**

* ## **El operador hereda todo el contexto.**

## ---

## **US-5.2 Hand-off automático por frustración** **Como Sistema,** **quiero detectar señales de frustración del cliente,** **para derivar la conversación a un humano antes de escalar el conflicto.**

## ***Criterios de aceptación:***

* ## **Se detectan palabras clave y tono negativo.**

* ## **El operador es notificado automáticamente.**

* ## **Se genera una respuesta empática inicial.**

## ---

### **ÉPICA 6 – Assist Score, ROI y Observabilidad**

## **Objetivo de negocio: Medir impacto financiero real y continuo.**

## **US-6.1 Autoevaluación periódica de la IA** **Como Sistema,** **quiero evaluar cada conversación cada N turnos,** **para determinar si generó valor comercial o de soporte.**

## ***Criterios de aceptación:***

* ## **Cada conversación recibe una calificación.**

* ## **La evaluación no interrumpe la conversación.**

* ## **Los resultados se almacenan para análisis.**

## ---

## **US-6.2 Cálculo de ROI por conversación** **Como Comerciante Administrador,** **quiero ver el ROI generado por cada conversación asistida por IA,** **para evaluar el retorno real de la plataforma.**

## ***Criterios de aceptación:***

* ## **El ROI se expresa en valores monetarios.**

* ## **Se asocia a agente y canal.**

* ## **Es auditable.**

## ---

## **ÉPICA 7 – Creative Automation Studio**

## **Objetivo de negocio: Transformar automáticamente el conocimiento del catálogo en activos de marketing accionables, reduciendo tiempo, costo y dependencia de recursos externos.**

## ---

## **US-7.1 Generación visual one‑click** **Como Comerciante Administrador,** **quiero generar piezas visuales publicitarias a partir de un producto existente,** **para lanzar campañas sin depender de diseñadores ni herramientas externas.**

## ***Criterios de aceptación:***

* ## **El producto se selecciona desde el catálogo sincronizado.**

* ## **El activo visual respeta identidad de marca (tono, colores, estilo).**

* ## **El resultado es editable y descargable.**

## ---

## **US-7.2 Variantes creativas automáticas** **Como Comerciante Administrador,** **quiero generar múltiples variantes creativas del mismo producto,** **para testear distintos mensajes y estilos.**

## ***Criterios de aceptación:***

* ## **Se generan al menos 3 variantes diferenciadas.**

* ## **Cada variante mantiene datos reales de producto.**

* ## **El usuario puede elegir la versión final.**

## ---

## **US-7.3 Copys persuasivos multicanal** **Como Comerciante Administrador,** **quiero textos persuasivos adaptados a cada red social,** **para maximizar conversión respetando el tono de marca.**

## ***Criterios de aceptación:***

* ## **Los textos siguen frameworks de venta reconocibles.**

* ## **Se adaptan por canal (IG, FB, WA).**

* ## **El usuario puede editar antes de publicar.**

## ---

## **ÉPICA 8 – Gobierno Humano–IA Avanzado**

## **Objetivo de negocio: Garantizar control humano, cumplimiento de políticas y mitigación de riesgos reputacionales.**

## ---

## **US-8.1 Reglas de intervención humana** **Como Comerciante Administrador,** **quiero definir reglas que obliguen a intervención humana,** **para mantener control en situaciones sensibles.**

## ***Criterios de aceptación:***

* ## **Las reglas son configurables por tipo de evento.**

* ## **El sistema respeta la prioridad humana.**

* ## **Las reglas pueden activarse o desactivarse.**

## ---

## **US-8.2 Auditoría de decisiones del agente** **Como Stakeholder,** **quiero auditar por qué un agente tomó una decisión específica,** **para evaluar riesgos y mejorar reglas.**

## ***Criterios de aceptación:***

* ## **Cada decisión queda registrada.**

* ## **Se muestra contexto y objetivo del agente.**

* ## **Es accesible sin conocimientos técnicos.**

## ---

## **ÉPICA 9 – Observabilidad Operativa**

## **Objetivo de negocio: Permitir monitoreo en tiempo real del comportamiento del sistema.**

## ---

## **US-9.1 Estado en tiempo real de agentes** **Como Operador Humano,** **quiero ver el estado actual de cada agente,** **para anticipar problemas operativos.**

## ***Criterios de aceptación:***

* ## **Estados visibles: activo, pausado, en hand‑off.**

* ## **Actualización en tiempo real.**

* ## **Identificación clara por rol.**

## ---

## **US-9.2 Alertas operativas** **Como Operador Humano,** **quiero recibir alertas ante anomalías,** **para intervenir antes de afectar al cliente.**

## ***Criterios de aceptación:***

* ## **Alertas configurables.**

* ## **Notificación inmediata.**

* ## **Registro histórico.**

## ---

## **ÉPICA 10 – ROI como Flujo Vivo**

## **Objetivo de negocio: Medir valor generado por la IA como proceso continuo, no solo como reporte.**

## ---

## **US-10.1 Assist Score por conversación** **Como Sistema,** **quiero evaluar periódicamente cada conversación,** **para determinar si generó valor comercial o de soporte.**

## ***Criterios de aceptación:***

* ## **Evaluación automática cada N turnos.**

* ## **No interrumpe la conversación.**

* ## **Score persistente y auditable.**

## ---

## **US-10.2 Atribución económica directa** **Como Comerciante Administrador,** **quiero ver el impacto económico atribuido a cada agente,** **para decidir dónde invertir más automatización.**

## ***Criterios de aceptación:***

* ## **El valor se expresa en moneda.**

* ## **Asociado a canal y rol.**

* ## **Comparativo contra costo de IA.**

## ---

## **ÉPICA 11 – Descomposición Operativa para Jira / Scrum**

## **Objetivo: Facilitar ejecución ágil sin ambigüedad.**

## **Para cada épica:**

* ## **Historias priorizables**

* ## **Dependencias explícitas**

* ## **Orden sugerido de implementación**

## **Ejemplo:**

* ## **ÉPICA 7 depende de ÉPICA 2**

* ## **ÉPICA 10 depende de ÉPICA 6**

## ---

## **ÉPICA 12 – Trazabilidad Funcional**

## **Objetivo: Asegurar que cada capacidad del sistema tenga representación en producto.**

## ---

## **US-12.1 Mapa de trazabilidad** **Como Product Owner,** **quiero un mapa entre capacidades y épicas,** **para asegurar cobertura funcional total.**

## ***Criterios de aceptación:***

* ## **Ningún módulo queda sin épica.**

* ## **La trazabilidad es bidireccional.**

* ## **Se mantiene actualizada.**

## ---

## **ÉPICA 13 – Bóveda de Credenciales Soberana (The Vault)**

## **Objetivo de negocio: Garantizar que cada comercio sea dueño y custodio único de sus llaves de API, sin que la plataforma tenga acceso global a ellas.**

## **US-13.1 Encriptación en reposo (Zero-Knowledge)** **Como Sistema,** **quiero encriptar todas las credenciales antes de guardarlas en la base de datos,** **para que incluso un administrador de base de datos no pueda verlas.**

## ***Criterios de aceptación:***

* ## **Uso de algoritmos estándar (ej: AES-256).**

* ## **La llave de desencriptación (Master Key) se inyecta en tiempo de ejecución.**

* ## **NUNCA se guardan keys en texto plano.**

## ---

## **US-13.2 Inyección dinámica (Just-in-Time)** **Como Sistema,** **quiero desencriptar las credenciales solo en el momento exacto de uso y borrarlas de la memoria inmediatamente después,** **para minimizar la superficie de ataque.**

## ***Criterios de aceptación:***

* ## **El agente recibe la credencial solo durante el "turno" de ejecución.**

* ## **No hay variables de entorno globales compartidas entre tenants.**

## ---

## **ÉPICA 14 – Integración y Onboarding (Magic Wizard)**

## **Objetivo de negocio: Reducir la fricción de entrada a < 5 minutos mediante descubrimiento automático de activos.**

## **US-14.1 Descubrimiento de activos (OAuth Diplomat)** **Como Comerciante Nuevo,** **quiero conectar mi cuenta de Facebook/Google y que el sistema detecte automáticamente mis páginas y negocios,** **para no tener que copiar y pegar IDs manualmente.**

## ***Criterios de aceptación:***

* ## **Flujo OAuth seguro con intercambio de tokens.**

* ## **Listado automático de activos elegibles.**

* ## **Manejo de tokens de larga duración (Long-Lived Tokens).**

## ---

## **US-14.2 Configuración One-Click ("Hacer Magia")** **Como Comerciante Nuevo,** **quiero un botón "Hacer Magia" que configure todos mis agentes básicos automáticamente,** **para empezar a vender en minutos.**

## ***Criterios de aceptación:***

* ## **Creación automática de agente de Ventas y Soporte.**

* ## **Ingesta inicial de catálogo (si hay integración conectada).**

* ## **Configuración de respuestas por defecto.**

## ---

## **ÉPICA 15 – Infraestructura y Auto-Mantenimiento (Reliability)**

## **Objetivo de negocio: Minimizar el tiempo de inactividad y mantenimiento manual.**

## **US-15.1 Auto-reparación de esquema (Self-Healing Database)** **Como DevOps,** **quiero que el sistema detecte y repare discrepancias en la base de datos al inicio,** **para evitar caídas por "Schema Drift".**

## ***Criterios de aceptación:***

* ## **Verificación de tablas y columnas críticas al arrancar.**

* ## **Creación automática de índices faltantes.**

* ## **Reporte de reparaciones ejecutadas.**

## ---

## **US-15.2 Delivery Relay Unificado** **Como Sistema,** **quiero centralizar la salida de mensajes en un solo gateway,** **para aplicar políticas de "rate limiting" y "human spacing" (retraso natural) de forma consistente.**

## ***Criterios de aceptación:***

* ## **Cola de salida única para todos los canales.**

* ## **Retraso configurable entre mensajes (efecto "escribiendo").**

* ## **Manejo de reintentos ante fallos de API externa.**

## ---

## **6\. Requerimientos No Funcionales**

### **Desempeño**

* ## **Respuesta percibida \< 3s**

* ## **Onboarding \< 5 minutos**

### **Escalabilidad**

* ## **Soporte picos x10**

* ## **No pérdida de estado**

### **Seguridad y Soberanía**

* ## **Aislamiento multi-tenant estricto**

* ## **Credenciales encriptadas**

### **Observabilidad**

* ## **Logs por conversación**

* ## **Métricas auditables**

## ---

## **7\. Descomposición Operativa para Jira / Scrum**

## **Cada épica se descompone en:**

* ## **Historias de usuario listas para backlog**

* ## **Tareas funcionales (no técnicas)**

* ## **Dependencias explícitas**

## **Ejemplo:**

## **ÉPICA 1 – Orquestación de Agentes**

* ## **Historia: Crear agente**

* ## **Tareas: definir rol, validar límites, habilitar monitoreo**

* ## **Dependencia: Knowledge Layer**

## ---

## **8\. Trazabilidad Sistema Real → PRD**

| Capacidad Observada | Épica |
| ----- | ----- |
| **Multi-agente** | **ÉPICA 1** |
| **Shadow RAG** | **ÉPICA 3** |
| **Assist Score** | **ÉPICA 6** |
| **Omnicanal soberano** | **ÉPICA 4** |

## ---

## **9\. Resultado Esperado**

## **Este documento permite:**

* ## **Planificar releases**

* ## **Estimar esfuerzo**

* ## **Cargar Jira sin leer código**

* ## **Reimplementar Nexus en cualquier stack sin pérdida funcional**

## ---

## **Fin del Documento**

## 
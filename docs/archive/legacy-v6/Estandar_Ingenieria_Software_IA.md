# **Estándar Global: Ingeniería de Software Asistida por Agentes y Skills**

**Versión del Documento:** 6.0 (Antigravity Complete Edition)

**Basado en:** Metodología "Gentleman Programming" & Google Antigravity

**Propósito:** Definir la arquitectura técnica, la estructura de archivos, los protocolos de delegación y la metodología operativa para escalar la inteligencia de un codebase.

# **PARTE I: ARQUITECTURA TÉCNICA (El Sistema)**

## **1\. Filosofía Core: Gestión de Contexto**

El problema fundamental de los LLMs en ingeniería de software no es la capacidad de razonamiento, sino la **saturación de contexto**.

* **Contexto Excesivo:** Lleva a alucinaciones, pérdida de foco y respuestas genéricas. Cuanto más código le das al agente, más se confunde.  
* **Contexto Insuficiente:** Lleva a código que no compila, usa librerías que no tienes instaladas o rompe los estándares del proyecto.

**Solución:** Una arquitectura modular donde la información "cultural" del proyecto y las habilidades técnicas ("Skills") se inyectan dinámicamente solo cuando son necesarias. El objetivo es que la IA entienda *cómo* trabajamos antes de escribir una sola línea de código.

## **2\. Arquitectura de Archivos de Contexto (agents.md)**

El agents.md actúa como el "Sistema Operativo" para el Agente. A diferencia de un README.md que es para consumo humano, este archivo contiene instrucciones de comportamiento, mapas de arquitectura y directivas estrictas formateadas para que un LLM las priorice.

### **2.1. Reglas de Diseño del agents.md**

1. **Objetivo:** Definir la "Cultura del Proyecto" (Convenciones, Estructura de carpetas, Tecnologías exactas).  
2. **Límite de Tamaño:** Mantener entre **250 y 500 líneas**. Si es más largo, el modelo empieza a ignorar instrucciones del principio o final ("Lost in the Middle phenomenon").  
3. **Contenido Obligatorio:**  
   * *Project Overview:* Qué hace el software y cuál es su negocio.  
   * *Tech Stack:* Tecnologías principales con versiones (ej. "NextJS 14, no 12").  
   * *Architecture Map:* Dónde encontrar los componentes, servicios y utilidades.  
   * *Guidelines:* Reglas de oro (ej. "No borres logs", "Usa TypeScript estricto", "Prohibido usar any").

### **2.2. Estrategia de Fragmentación (Monorepos)**

Para proyectos grandes, un solo archivo no escala. Usamos una estructura distribuida:

* **ROOT/agents.md (El Orquestador):**  
  * Contiene el mapa de alto nivel.  
  * Instruye al agente a buscar contextos más profundos.  
  * *Directiva:* "Si el usuario pide tareas de UI, consulta obligatoriamente el archivo ui/agents.md antes de responder".  
* **SUB-MODULE/agents.md (Contexto Específico):**  
  * Ubicados en carpetas de dominio (ej. /ui/agents.md, /api/agents.md).  
  * Contienen reglas específicas de ese micromundo (ej. en UI: "Usamos Tailwind y Server Actions").

## **3\. Sistema de Skills (Habilidades Modulares)**

Las **Skills** son unidades de conocimiento encapsuladas para tareas específicas. Permiten "enseñar" a la IA una tarea compleja (como hacer un deploy o una migración de DB) una sola vez y reutilizarla infinitamente.

### **3.1. Estructura de un Archivo de Skill (.md)**

Ubicación estándar: .github/skills/ o .agent/skills/ (para Antigravity).

#### **A. Metadatos (Frontmatter YAML)**

Esta sección es crítica para que los scripts de automatización sepan dónde inyectar la skill.

\---  
name: "NextJS Server Actions"  
description: "Estándar oficial para crear mutaciones de datos en el servidor."  
trigger: "Cuando el usuario pida crear una acción de servidor, modificar base de datos o manejar forms."  
scope: "UI"  \# CRÍTICO: Define que esta skill se inyecta en 'ui/agents.md'  
auto-invoke: true \# Fuerza la lectura automática si el agente detecta keywords  
tools: \["read\_file", "write\_file"\] \# Herramientas permitidas para esta skill  
\---

#### **B. Cuerpo del Contenido**

1. **Guía Técnica:** Paso a paso de la implementación.  
2. **Templates:** Código base (boilerplate) para copiar y pegar.  
3. **Few-Shot Examples (Crucial):** Ejemplos de *Input* (lo que pide el usuario) y *Output* (cómo debe responder el agente). Esto reduce drásticamente el error al darle un patrón a imitar.

## **4\. Automatización e Infraestructura ("El Hack")**

Dado que Claude busca en .claude/, Copilot en .github/ y otros en .vscode/, necesitamos un sistema agnóstico.

### **4.1. Script de Setup (setup.sh)**

Garantiza compatibilidad multiplataforma mediante **Enlaces Simbólicos (Symlinks)**.

* Crea las carpetas .claude, .gemini, .vscode.  
* Genera symlinks desde la carpeta central /skills/ hacia dentro de cada carpeta de configuración.  
* *Resultado:* Editas la skill en un solo lugar (/skills/react.md) y se actualiza instantáneamente para todas las IAs.

### **4.2. Script de Sincronización (sync)**

Conecta las Skills con los agents.md dinámicamente.

* Lee el Frontmatter de todas las skills.  
* Si scope: UI \-\> Busca ui/agents.md e inyecta el nombre y descripción de la skill en una sección "Available Skills".  
* Si scope: ROOT \-\> Inyecta la referencia en ./agents.md.  
* *Beneficio:* El agente sabe qué herramientas tiene disponibles sin tener que leer el contenido de todas (ahorro de tokens).

## **5\. Protocolo de Delegación Jerárquica (Orquestador y Sub-Agentes)**

El proceso de trabajo no es una conversación lineal, sino un flujo de ingeniería donde la jerarquía es vital para mantener la "higiene" del contexto.

### **5.1. El Rol del Agente Orquestador (Gerente Técnico)**

El agente principal (Root) evoluciona. Su responsabilidad **ya no es ejecutar código inmediatamente**, sino entender la intención macro y gestionar recursos.

1. **Recepción:** Recibe el prompt (ej. "Crea un botón en la UI").  
2. **Análisis de Costo:** Evalúa si la tarea requiere leer muchos archivos. Si es así, **NO** lo hace él mismo para no llenar su contexto de "ruido".  
3. **Decisión de Delegar:** Instancia un Sub-Agente especializado para la tarea sucia (investigación, lectura masiva, pruebas).

### **5.2. Creación y Aislamiento del Sub-Agente ("Cajas Negras")**

Cuando el Orquestador delega, se genera un Sub-Agente con una característica crítica: **Contexto Aislado**.

* **La Burbuja:** El Sub-Agente vive en su propio hilo. Lo que sucede dentro (comandos fallidos, lecturas de archivos irrelevantes, cat de logs gigantes) **jamás contamina** el contexto del Orquestador.  
* **Ejecución de Skills:** El Sub-Agente carga la Skill específica (ej. UI\_Inspection) y usa herramientas (como grep, glob o ls) para investigar patrones existentes.  
* **Paralelización:** El Orquestador puede disparar múltiples Sub-Agentes en paralelo (ej. uno revisa la Base de Datos, otro revisa el Frontend) para atacar problemas complejos simultáneamente.

### **5.3. El "Handoff" (Retorno de Información Sanitizada)**

Este es el punto clave de la metodología.

1. **El Resumen:** Una vez que el Sub-Agente termina, **NO** devuelve su historial de chat. Devuelve únicamente un **Resumen Ejecutivo Procesado**.  
   * *Mal Handoff:* "Leí el archivo A, luego el B, el B no servía, luego leí el C..." (Ruido).  
   * *Buen Handoff:* "Existen componentes de botón en /src/ui/Button.tsx. Usan la variante primary por defecto." (Señal).  
2. **Integración:** El Orquestador recibe este resumen limpio. Su ventana de contexto apenas crece, manteniéndose eficiente y libre de alucinaciones.

### **5.4. Toma de Decisiones Final**

Con el resumen en mano, el Orquestador retoma el control para interactuar con el usuario o generar el código final, asegurando que la solución sea coherente con la arquitectura global.

# **PARTE II: METODOLOGÍA Y OPERACIONES (El Mindset)**

## **6\. Filosofía Operativa: El Compilador de Ideas**

El uso de IA no reemplaza el conocimiento técnico; lo amplifica. La IA debe tratarse como un "Compilador de Ideas" o un "Teclado Inteligente".

* **Rol del Ingeniero (Tony Stark):** Eres el arquitecto y el dueño de la verdad. Defines el "qué" (requerimientos), el "cómo" (arquitectura) y los límites de seguridad.  
* **Rol de la IA (Jarvis):** Es el ejecutor. No piensa por ti, implementa tus instrucciones. Si tu instrucción carece de fundamentos técnicos, el resultado será técnicamente correcto pero funcionalmente inútil ("Basura entra, basura sale").

## **7\. Protocolo de Validación ("Trust but Verify")**

La IA se comporta como un compañero de trabajo con exceso de confianza que nunca dice "no sé".

### **7.1. Riesgos de Alucinación Técnica**

Los modelos mezclan documentación desactualizada con características nuevas.

* **Caso Real (React 19):** Al pedir código de React 19, la IA suele mezclar imports nuevos (useActionState) con hooks obsoletos (useFormState de versiones Canary) o patrones viejos (useEffect para todo). El código parece real, pero falla al compilar.

### **7.2. Checklist de Auditoría Obligatoria**

Nunca aceptes el primer output (Zero-shot) sin verificar:

1. **Tipado:** ¿Hay any ocultos o tipos inferidos erróneamente?  
2. **Manejo de Errores:** ¿Usa console.log (inseguro) o el logger del sistema? ¿Captura promesas rechazadas?  
3. **Resiliencia:** ¿Hay lógica de retry en peticiones HTTP críticas?  
4. **Seguridad:** ¿Están saneados los inputs? ¿Se exponen secretos en el cliente?

## **8\. Ingeniería de Prompts Contextual (El "Input" Correcto)**

Abandona el "Prompt de Manager" (vago: "haz un login") y adopta el "Prompt de Ingeniero" (específico).

### **8.1. Anatomía de un Prompt de Ingeniero**

Un prompt efectivo declara explícitamente:

* **Stack:** (ej. React 19, TS Strict, Tailwind).  
* **Librerías:** (ej. React Hook Form \+ Zod).  
* **Patrones:** (ej. Container/Presentational).  
* **Variables de Entorno:** (ej. Usar variables del Design System propio).  
* **No-Funcionales:** Accesibilidad (A11y), SSR vs CSR.

### **8.2. Uso de Referencias (@)**

Utiliza la capacidad de los agentes para leer archivos específicos (Contexto Mínimo Viable).

* *Prompt:* "Crea un formulario de login siguiendo la estructura de **@TaskForm** y usando los estilos de **@GlobalStyles**".  
* *Efecto:* Fuerza el **mimetismo de código**. La IA no inventa un estilo nuevo; copia la estructura de tu mejor código existente.

## **9\. Evolución de Skills: "Lazy Loading" de Contexto**

Cuando una Skill crece demasiado (más de 500 líneas), satura al agente y degrada el rendimiento.

### **9.1. Estrategia de Assets**

Divide la Skill en tres partes:

1. **Skill Principal (.md):** Instrucciones ligeras de "cuándo" y "qué" hacer.  
2. **Carpeta assets/:** Contiene archivos separados con ejemplos de código ("one-shot examples") o templates grandes.  
3. **Referencias:** Links a documentación interna.

**Flujo:** El agente lee la Skill principal. Solo si necesita ver cómo es la sintaxis exacta, lee el archivo en assets/. Es un "Lazy Loading" cognitivo que mantiene la ventana de contexto limpia.

## **10\. Configuración del "Agente Socrático"**

Configura el System Prompt o el agents.md raíz para adoptar una personalidad cuestionadora, evitando código prematuro.

* **Instrucción al Agente:** "Si el prompt del usuario es vago ('arregla esto') o le falta contexto técnico, **NO generes código**. Detente y haz preguntas clarificadoras: ¿Qué parte se rompió? ¿Bajo qué condiciones? ¿Qué esperas?"  
* **Valor:** Ahorra tokens y evita iteraciones sobre soluciones incorrectas. Obliga al humano a refinar su pensamiento antes de gastar recursos.

## **11\. Mindset: Ruptura de Límites Mentales**

Existe una paradoja observada: Los Ingenieros Seniors asumen límites ("la IA no puede hacer eso, es muy complejo"); los Juniors prueban todo y a menudo logran más.

### **11.1. Protocolo para Problemas Complejos**

Ante bugs difíciles (Memory leaks, análisis de logs masivos de AWS):

1. **No asumas** que es "demasiado complejo".  
2. Proporciona todo el contexto crudo (logs, gráficas, estructura de archivos).  
3. Pide **diagnóstico**, no solo código.  
4. *Caso de éxito:* Usar la IA para ingerir métricas de CPU y generar un dashboard de visualización personalizado en HTML/D3.js en minutos, una tarea que manualmente llevaría horas.

## **12\. Flujo de Trabajo (Ciclo de Vida)**

El ciclo no es lineal, es iterativo y centrado en la calidad del *input*.

1. **Definición (Humano):** Piensas la arquitectura y requisitos (Tony Stark).  
2. **Contextualización:** Invocas al agente con referencias explícitas @ y Skills activas.  
3. **Ejecución (Orquestador/Sub-Agentes):** Se ejecuta la delegación, investigación y generación.  
4. **Auditoría (Humano):** Revisión línea por línea (versiones, seguridad, tipos).  
5. **Iteración Correctiva:** Si el resultado es pobre, **no corrijas el código a mano inmediatamente**. Corrige el Prompt o mejora la Skill (agrega un ejemplo a assets/) y regenera. Esto mejora el sistema para el futuro.

# **PARTE III: GUÍA DE IMPLEMENTACIÓN FÍSICA (FILE SYSTEM)**

Esta sección detalla cómo estructurar las carpetas en el repositorio.

## **13\. Estructura de Directorios (Generic Standard)**

Para entornos generales (VSCode, Cursor, Windsurf) usando la configuración agnóstica .github.

/mi-proyecto-nuevo  
├── agents.md                 \<-- Orquestador  
├── .github/  
│   └── skills/               \<-- Skills Genéricas  
├── scripts/                  \<-- setup.sh / sync.py  
└── ...

## **13.1. Adaptación para Antigravity (Estructura .agent)**

Si utilizas **Antigravity**, la herramienta espera una estructura estricta llamada .agent. No uses la carpeta .github ni symlinks complejos; Antigravity gestiona esto nativamente.

/mi-proyecto-antigravity  
├── agents.md                 \<-- (A) Orquestador (Opcional, Antigravity lee el contexto global)  
├── .agent/                   \<-- (B) CORE DE ANTIGRAVITY  
│   ├── workflows/            \<-- (C) Flujos de Trabajo  
│   │   ├── feature\_dev.md    \<-- Especificación de cómo crear features  
│   │   ├── bug\_fix.md        \<-- Especificación de cómo arreglar bugs  
│   │   └── code\_review.md  
│   └── skills/               \<-- (D) Habilidades Modulares  
│       ├── React/            \<-- Carpeta por Skill  
│       │   └── SKILL.md      \<-- ¡OJO\! Nombre en mayúsculas recomendado por convención  
│       ├── Python/  
│       │   └── SKILL.md  
│       └── Docker/  
│           └── SKILL.md  
└── src/

### **Reglas Específicas para Antigravity:**

1. **Carpeta .agent:** Es invisible para el usuario promedio pero visible para el agente. Todo el cerebro vive aquí.  
2. **Subcarpeta workflows/:**  
   * Aquí residen los .md que definen **procesos**, no tecnologías.  
   * *Ejemplo workflows/feature.md:* "Pasos: 1\. Leer requerimiento. 2\. Crear test fallido. 3\. Implementar código. 4\. Refactorizar".  
3. **Subcarpeta skills/:**  
   * Cada skill debe tener **su propia carpeta** (ej. .agent/skills/React/).  
   * El archivo de definición debe llamarse SKILL.md dentro de esa carpeta.  
   * Antigravity indexa automáticamente estos archivos, por lo que el *Frontmatter* (Trigger/Scope) es vital para que sepa cuándo usarlos sin que se lo pidas explícitamente.

## **14\. Detalle de Archivos y Carpetas**

### **A. El Archivo agents.md (Root)**

Este archivo vive en la raíz y actúa como el "director de tráfico" para el agente.

* **Función Clave:** Si el usuario pregunta por algo de UI, este archivo le dice al agente: *"Si quieres algo de UI, ve a la carpeta src/UI/ y lee el agents.md de allí"*.  
* **Contenido:** Define la cultura del proyecto, arquitectura general y mapa de navegación.  
* **Listado de Skills:** Debe contener referencias a las skills genéricas (ej. Commits, Pull Requests) inyectadas automáticamente por el script sync.

### **B. La Carpeta Central de Skills (Generic vs Antigravity)**

Aquí residen las "habilidades" modulares.

**Caso Antigravity (.agent/skills/NombreSkill/SKILL.md):**

\---  
name: "React Components"  
description: "Reglas para componentes UI."  
trigger: "Al crear o editar .tsx"  
auto-invoke: true  
\---  
\# React Guidelines...

### **C. Carpetas de Configuración de Proveedores (El "Hack")**

Cada IA busca instrucciones en lugares diferentes. No duplicamos archivos; usamos **Symlinks**.

* **.claude/:** Para Anthropic. Contiene claude.md (copia de agents.md) y un symlink a skills/.  
* **.vscode/:** Para GitHub Copilot.  
* **.gemini/:** Para Google (si aplica).

**Estrategia de Symlinks:** El script setup.sh crea enlaces simbólicos. Si actualizas skills/React/skill.md, se actualiza instantáneamente para Claude, Copilot y Gemini.

### **D. Scripts de Automatización (/scripts)**

Para mantener la arquitectura sin esfuerzo manual.

1. **setup.sh (Inicializador):**  
   * Crea las carpetas ocultas (.claude, .vscode).  
   * Genera los enlaces simbólicos (symlinks) desde .github/skills.  
   * Copia y renombra agents.md \-\> claude.md.  
2. **sync (Sincronizador):**  
   * Lee la propiedad Scope del frontmatter de cada skill.  
   * Si Scope: UI \-\> Inyecta la referencia en src/UI/agents.md.  
   * Si Scope: Root \-\> Inyecta la referencia en ./agents.md.  
   * *Resultado:* Los agentes siempre saben qué skills tienen disponibles en su contexto actual.

### **E. Contextos Específicos (src/UI/agents.md)**

En monorepos o proyectos grandes, divide el contexto.

* **Propósito:** Contiene reglas que **solo** aplican a esa área.  
  * *Ejemplo UI:* "Usamos Tailwind y Framer Motion".  
  * *Ejemplo API:* "Usamos FastAPI y Pydantic".  
* **Conexión:** El Agente Orquestador llega aquí derivado desde el agents.md raíz.

## **15\. Resumen para Implementar Hoy**

1. Crea un agents.md en la raíz con la visión general.  
2. **(Opción A \- General):** Crea .github/skills.  
3. **(Opción B \- Antigravity):** Crea .agent/skills y .agent/workflows.  
4. Asegúrate de que cada skill tenga **Metadatos** (Scope, Trigger).  
5. Ejecuta los scripts de sincronización para mantener el cerebro de tu IA actualizado.

# **PARTE IV: IMPLEMENTACIÓN ESPECIALIZADA (GOOGLE ANTIGRAVITY)**

Esta sección detalla cómo configurar y potenciar la arquitectura de Agentes usando **Google Antigravity**, un IDE de nueva generación que permite a los agentes tener "manos" (control del navegador) y "memoria experta" (Skills autogeneradas).

## **16\. Concepto: El IDE para Agentes**

Antigravity no es solo un chat; es una plataforma donde los agentes actúan como empleados completos.

* **Capacidades Extendidas:** Pueden controlar el navegador, editar archivos, usar la terminal y ejecutar comandos complejos.  
* **Skills Nativas:** Antigravity implementa visualmente la arquitectura de Skills que definimos anteriormente. Reconoce automáticamente la carpeta .agent/skills y la muestra en la barra lateral como herramientas ejecutables.

## **17\. Configuración del Entorno (Setup)**

1. **Instalación:** Descarga Google Antigravity (Mac/Windows/Linux) e inicia sesión con Google.  
2. **Estructura de Proyecto:**  
   * Abre Antigravity y selecciona "Open Folder".  
   * Crea tu carpeta de proyecto (ej. Proyecto\_Antigravity).  
   * **Importante:** Esta carpeta será tu *Codebase* donde residirán el agents.md y la carpeta .agent/skills/.

## **18\. Estrategias de Creación de Skills**

Existen tres métodos para poblar tu arsenal de habilidades en Antigravity:

### **A. Método 1: Auto-Generación (Skill Creator)**

Enséñale al agente a crear sus propias herramientas.

* **Prompt Inicial:** "Actúa como un 'Creador de Skills'. Lee la documentación oficial de Antigravity y crea una habilidad llamada 'Skill Maker' que me permita generar nuevas skills siguiendo el estándar."  
* **Ejecución:** El agente leerá la documentación web y generará los archivos SKILL.md automáticamente.  
* **Resultado:** Tendrás un experto residente en la barra lateral capaz de crear cualquier otra skill futura.

### **B. Método 2: Importación (Compatibilidad Gentleman)**

Antigravity es 100% compatible con la arquitectura de archivos .md.

* **Repositorios Comunitarios:** Puedes clonar repositorios de skills (ej. "Antigravity Awesome Skills") directamente en tu carpeta .agent/skills.  
* **Manual:** Crea una carpeta .agent/skills/React/, añade un SKILL.md con tus reglas, y Antigravity lo reconocerá instantáneamente.  
* **Validación:** Esto confirma la arquitectura agnóstica: un skill creado para Claude funciona en Antigravity sin cambios.

### **C. Método 3: Investigación Profunda (NotebookLM Bridge)**

Para skills de conocimiento experto (ej. "Estratega de Marca"), usa NotebookLM.

1. **Cura de Contenido:** Sube PDFs, videos o webs a NotebookLM.  
2. **Generación:** Pide a NotebookLM: *"Crea un prompt detallado para una Skill de Asesor Estratégico basado en estas fuentes"*  
3. **Implementación:** Copia ese texto y pégalo en un nuevo SKILL.md en Antigravity.  
   * *Valor:* Tu agente ahora tiene el conocimiento condensado de 100 fuentes expertas.

## **19\. Orquestación y Flujo de Trabajo (El Equipo Virtual)**

Antigravity permite simular la arquitectura de "Orquestador y Subagentes" encadenando habilidades.

### **Caso de Uso: App Builder (Data Driven)**

En lugar de un solo prompt, configura una secuencia de agentes especializados:

1. **Agente Investigador (Subagente 1):**  
   * *Skill:* Reddit\_Scraper o Market\_Researcher.  
   * *Tarea:* Analiza la competencia y la "voz del usuario". Genera un reporte research.md.  
2. **Agente Desarrollador (Subagente 2):**  
   * *Skill:* React\_Developer (con acceso a tus reglas de agents.md).  
   * *Tarea:* Lee research.md y genera el código funcional (ej. npm create vite).  
3. **Agente Documentador (Subagente 3):**  
   * *Skill:* Tech\_Writer.  
   * *Tarea:* Crea el README.md y la guía de uso.

## **20\. Integración de Contexto Personal (Personal Intelligence)**

Antigravity introduce una capa de **Personal Intelligence** mediante la integración con el ecosistema de Google.

* **Conexión a Datos:** Permite acceso a Gmail, Drive y Docs.  
* **Aplicación Práctica:**  
  * Si pides *"Arregla el bug que reportó el cliente ayer"*, el agente buscará en tu Gmail el reporte de error específico.  
  * Si pides *"Usa los colores de la marca"*, el agente leerá el manual de marca desde tu Google Drive.  
* **Para Programadores:** El agente puede leer tus documentos de arquitectura (agents.md) directamente desde Drive si no están en local.

## **21\. Resumen de Buenas Prácticas en Antigravity**

1. **Utiliza el "Skill Creator":** No escribas skills a mano. Usa la skill maestra para generar nuevas estandarizadas.  
2. **Lazy Loading Manual:** Activa solo las skills necesarias en la barra lateral para no confundir al modelo.  
3. **Validación Humana (Tony Stark):** Revisa siempre el SKILL.md generado antes de usarlo. Asegura que no tenga alucinaciones.  
4. **Repositorio Central:** Mantén tus skills en un repo de GitHub y clónalo en cada proyecto nuevo. Antigravity leerá las herramientas automáticamente.
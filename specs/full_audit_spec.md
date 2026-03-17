# SPEC: Audit Completo y Corrección de Errores - MultiAgents Platform ROI

## Fecha: 2026-03-17
## Alcance: Todas las páginas, componentes, hooks, contextos y servicios

---

## RESUMEN EJECUTIVO

Se identificaron **120+ problemas** en todo el proyecto:
- **8 Críticos** (crashes, seguridad)
- **25 High** (lógica rota, memory leaks, datos falsos)
- **45 Medium** (UX, i18n, validación)
- **42+ Low** (estilo, tipos, accesibilidad)

---

## ISSUES CRÍTICOS (P0 - Deben arreglarse YA)

### C1: XSS en Chats.tsx (línea 611)
- `dangerouslySetInnerHTML` con contenido sin sanitizar
- **Fix**: Usar DOMPurify o escapar HTML antes de renderizar

### C2: Admin token hardcodeado en useApi.ts (línea 4)
- `ADMIN_TOKEN` defaults to `"admin-secret-99"` y se envía en cada request
- Se exporta y usa en MagicOnboarding.tsx y Console.tsx en URLs
- **Fix**: Eliminar fallback hardcodeado, no exportar token

### C3: Token expuesto en URLs (MagicOnboarding.tsx:225, Console.tsx)
- `ADMIN_TOKEN` en query params de EventSource URLs
- **Fix**: No pasar tokens en URLs, usar cookies o headers

### C4: Import faltante crash - Templates.tsx (línea 227)
- `Trash2` de lucide-react usado pero nunca importado → ReferenceError
- **Fix**: Agregar import

### C5: Ref undefined crash - SetupExperience.tsx (línea 346)
- `messagesEndRef` referenciado pero nunca declarado → ReferenceError
- **Fix**: Declarar useRef o cambiar a scrollRef existente

### C6: Operator precedence bug - MetaOnboardingWizard.tsx (línea 171)
- `||` y `&&` sin paréntesis produce texto de botón incorrecto
- **Fix**: Agregar paréntesis correctos

### C7: Hardcoded tenant_id: 1 en OnboardingChat.tsx (líneas 43, 74, 104)
- Todos los onboardings van al tenant 1 sin importar el usuario
- **Fix**: Usar tenant_id del usuario autenticado

### C8: EventSource memory leak - SetupExperience.tsx (línea 186)
- EventSource nunca se cierra al desmontar componente
- **Fix**: Guardar ref y cleanup en useEffect return

---

## ISSUES HIGH (P1)

### H1: Double JSON.stringify en Chats.tsx (línea 653) y Templates.tsx (línea 86)
- `fetchApi` ya hace stringify, duplicarlo corrompe el payload
- **Fix**: Pasar objeto sin stringify

### H2: API path inconsistente en Chats.tsx (líneas 651, 716)
- Usa `/api/` prefix en vez de `/admin/` como el resto
- **Fix**: Unificar a `/admin/`

### H3: Memory leak event listeners - Settings.tsx (línea 53-58)
- `window.addEventListener('message')` sin removeEventListener
- **Fix**: Agregar cleanup

### H4: Edit siempre hace POST - Tools.tsx (línea 82-104)
- handleSubmit siempre crea nuevo en vez de actualizar
- **Fix**: Usar PUT cuando formData.id existe

### H5: Response body leído 2 veces - useApi.ts (líneas 78-86)
- `response.text()` llamado dos veces, segunda vez da string vacío
- **Fix**: Guardar resultado en variable

### H6: Retry en requests no-idempotentes - useApi.ts (línea 128)
- POST/DELETE se reintentan causando duplicados
- **Fix**: Solo retry en GET y requests idempotentes

### H7: `loading` state compartido - useApi.ts (línea 36)
- Múltiples llamadas concurrentes compiten por el mismo state
- **Fix**: Usar loading counter o per-request loading

### H8: Debug console.log de env vars - useFacebookSdk.ts (línea 14)
- Imprime TODAS las variables de entorno en consola del browser
- **Fix**: Eliminar console.log

### H9: CSS inválido en SetupExperience.tsx (línea 24)
- camelCase CSS en `<style>` tag (alignItems en vez de align-items)
- **Fix**: Usar CSS válido con kebab-case

### H10: Timestamps incorrectos en logs (SetupExperience:343, MagicOnboarding:465)
- `new Date()` en render muestra hora actual, no hora del log
- **Fix**: Capturar timestamp al momento de recibir el log

### H11: Math.random() en render - PlatformTower.tsx (línea 117)
- Barras de chart cambian aleatoriamente en cada re-render
- **Fix**: Usar useMemo con datos estables

### H12: Componentes dentro de componentes - DynamicAgentWizard.tsx (551-750)
- KnowledgeSelector, ChannelSelector, ToolSelector definidos dentro del componente
- Se recrean cada render, pierden estado interno
- **Fix**: Extraer a archivos separados o top-level

### H13: Dummy password en Login.tsx (línea 45) y Register.tsx (línea 28)
- Envía `password: 'dummy'` en resend-verification
- **Fix**: No enviar password o enviar el real

### H14: Datos fake como reales - SystemStatus.tsx, TelemetryHUD.tsx
- PostgreSQL "healthy", Redis "active", latency "24ms" todo hardcodeado
- **Fix**: Usar datos del prop `health` que ya se recibe

### H15: Non-null assertions inseguras
- Agents.tsx:254, Stores.tsx:209, Credentials.tsx:214,237, Knowledge.tsx:383,394
- `id!` cuando id es optional → crash si undefined
- **Fix**: Agregar guard checks

### H16: Ruta /templates no existe en App.tsx
- Sidebar.tsx:65 linkea a /templates pero no hay route definido
- **Fix**: Agregar ruta en App.tsx

### H17: RagGalaxy.tsx hardcoded tenant_id=1 (línea 27)
- Todos ven datos del tenant 1
- **Fix**: Usar tenant_id del contexto de auth

### H18: RagGalaxy.tsx forced reflow en animation loop (líneas 50-53)
- offsetWidth/offsetHeight en cada frame causa layout thrashing
- **Fix**: Cachear dimensiones, resize solo en ResizeObserver

### H19: Error boundary expone stack traces (ErrorBoundary.tsx:62-65)
- En producción muestra file paths y stack traces
- **Fix**: Solo mostrar detalles en development

### H20: Unsafe credentials array access (YCloudSettings:36, ChatwootSettings:29)
- No null check antes de .find() en response de API
- **Fix**: Agregar validación

### H21: YCloudSettings status stuck en 'loading' (línea 46-48)
- Error en catch no actualiza status
- **Fix**: setStatus('missing') en catch

### H22: Stale closure en polling - Chats.tsx (líneas 216-236)
- setInterval captura referencia stale de loadChats
- **Fix**: Usar ref para la función o useCallback con deps

### H23: Variable `t` shadowing translation function
- Agents.tsx:64,303, Credentials.tsx:186,229,370, Settings.tsx:260
- `t` usado para tenants/items shadowing `t()` de useLanguage
- **Fix**: Renombrar loop variables a `tenant`, `item`, `cred`, etc.

---

## ISSUES MEDIUM (P2 - Selección de los más impactantes)

### M1: Hardcoded Spanish strings sin i18n (~15 archivos)
### M2: Missing useEffect dependencies (~12 archivos)
### M3: `alert()` y `confirm()` en vez de modales React (~8 archivos)
### M4: `window.location.href` en vez de React Router (~5 lugares)
### M5: Chatwoot/YCloud status hardcoded - Settings.tsx (189, 207)
### M6: Search input sin funcionalidad - BusinessForge.tsx (322)
### M7: "Nueva Coleccion" button sin onClick - Knowledge.tsx (203)
### M8: grid-cols-4 con solo 3 items - Analytics.tsx (46)
### M9: CSS class 'spin' inexistente - Logs.tsx (43)
### M10: Redundant condition - Settings.tsx (282)
### M11: XSS en script generado - WebSettings.tsx (48-70)
### M12: useFacebookSdk setIsReady(true) en error (líneas 37, 50)
### M13: EventSource sin JSON.parse try/catch - SetupExperience.tsx (209)
### M14: Empty validation blocks - Setup.tsx (17-25)
### M15: Falsy coercion con || en vez de ?? - Dashboard.tsx (116, 151)

---

## PLAN DE IMPLEMENTACIÓN

### Fase 1: Fixes Críticos (C1-C8)
### Fase 2: Fixes High (H1-H23)
### Fase 3: Fixes Medium (M1-M15)
### Fase 4: Fixes Low (mejoras menores)

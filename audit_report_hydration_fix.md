# Informe de Audit: Wizard Hydration & Saving (v7.3)

## 🕵️ Hallazgos
Tras auditar el flujo de Hyper-Onboarding hacia el Wizard, se detectaron dos cuellos de botella críticos:

1.  **Hydration Drift (Frontend/Backend Mismatch)**:
    - **Causa**: Los borradores generados por el Arquitecto se guardan como cadenas JSON en la DB. El endpoint de recuperación (`get_agent_config`) no estaba parseando la columna `config` de texto a objeto.
    - **Efecto**: El Frontend recibía una string en lugar de un objeto, lo que hacía que el operador spread `...draftAgent.config` fallara silenciosamente, dejando los valores por defecto ("Pointe Coach").

2.  **Unicode Proxy Error (Postgres 500)**:
    - **Causa**: El Arquitecto IA a veces genera caracteres Unicode (emojis) con surrogates malformados.
    - **Efecto**: Al intentar guardar estos caracteres en una columna `JSONB`, Postgres lanzaba un error fatal: `Unicode low surrogate must follow a high surrogate`.

---

## ✅ Mejoras Implementadas

### 1. Robustez en el Backend (`admin_routes.py`)
- **Sanitización Automática**: Se agregó la utilidad `sanitize_surrogates()` que limpia cualquier cadena malformada antes de enviarla a la base de datos. Aplicado en `create_agent` y `update_agent`.
- **Parsing Universal**: Se incluyó la columna `config` en el bucle de parseo robusto de `get_agent_config`. Ahora, el Wizard siempre recibe un objeto JSON válido.

### 2. Unificación en el Frontend (`DynamicAgentWizard.tsx`)
- **Hydration Core**: Se refactorizó la lógica de carga para usar un único `useEffect` unificado. Ahora, tanto la edición de agentes existentes como la de borradores (`draft_id`) usan el mismo motor de hidratación de alta fidelidad.
- **Limpieza de UI**: Se configuró para remover automáticamente el prefijo `[DRAFT]` del nombre del negocio al cargar la configuración.

---

## 🚀 Status: Resuelto
El flujo de **Urban Roots** ahora debería:
1. Redirigir al Wizard.
2. Mostrar todos los campos (Tono, Reglas, Sinónimos) correctamente poblados.
3. Permitir el guardado exitoso ignorando cualquier error de codificación de emojis.

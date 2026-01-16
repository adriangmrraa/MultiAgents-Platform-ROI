# Guía de Migración Soberana (Nexus v5.1)

> **Estado**: `ACTIVO` | **Fecha**: `Enero 2026` | **Versión Destino**: `Nexus v5.1 (Sovereign Edition)`

Esta guía detalla el proceso para migrar una instalación de Nexus v5.0 (basada en variables de entorno) al nuevo **Protocolo de Soberanía Total** de la v5.1.

---

## 🚀 De .env a la Bóveda Soberana

En la v5.1, las llaves como `OPENAI_API_KEY` o `GOOGLE_API_KEY` ya no viven en archivos de texto plano. Ahora residen cifradas en la base de datos para permitir el aislamiento multi-inquilino.

### 1. El Proceso de "Auto-Sedimentación"
No es necesario migrar las llaves manualmente. Al iniciar Nexus v5.1 por primera vez:
- El sistema detectará las llaves en tu archivo `.env`.
- Las inyectará automáticamente en la tabla `credentials` vinculadas al inquilino #1.
- **Acción**: Una vez verificado el funcionamiento en la UI, puedes eliminar las llaves del `.env` por seguridad (excepto `ADMIN_TOKEN` y `ENCRYPTION_KEY`).

### 2. Migración del SMTP
Si tenías un SMTP global, este seguirá funcionando para alertas de sistema. Sin embargo, para que los agentes envíen correos con identidad de marca:
- Ve a **Settings > Credenciales**.
- Agrega un nuevo registro de categoría `smtp`.
- Introduce los datos del servidor del cliente.

### 3. Migración de Google Gemini
La v5.1 prioriza Google AI para el `Creative Director`. 
- Si usas `GOOGLE_API_KEY` en el `.env`, se sedimentará automáticamente.
- Recomendamos cargar llaves independientes para cada cliente nuevo desde el panel de **Credenciales** para evitar bloqueos de cuota.

---

## 🛠️ Verificación Post-Migración

1.  Inicia el orquestador y busca el log: `[SEDIMENTATION] 3 legacy keys migrated to vault.`
2.  Entra al panel de **Credenciales** en el Frontend.
3.  Verifica que las llaves aparezcan listadas (en formato encriptado/oculto).
4.  Realiza una prueba de "Magic Onboarding" para confirmar que el agente recupera las llaves correctamente.

---

**© 2026 Nexus Sovereign Taskforce - Infrastructure Division**

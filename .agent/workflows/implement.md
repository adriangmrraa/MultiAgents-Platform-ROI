---
description: Ejecuta el plan de implementación de manera autónoma, escribiendo código, pasando tests y registrando cambios.
---

# 🚀 Antigravity Implement

Ejecución disciplinada con "Cero Vibe Coding".

1.  **Input**: Pide la ruta del plan (`docs/plans/[feature].md`).
2.  **Inyección de Reglas**:
    - Carga `.antigravity_rules`.
    - Carga las "Local Rules" del `.spec.md`.
3.  **Ejecución por Lotes** (vía `@executing-plans`):
    - Batch de 3 tareas.
    - Implementa -> Verifica (`/verify`) -> Commit.
4.  **Quality Gate**:
    - Antes de asumir una tarea "Hecha", ejecuta los tests definidos en Criterios de Aceptación.
    - Si falla, entra en **Self-Correction Loop** (Max 3 intentos).
5.  **Cierre**:
    - Actualiza el estado de la spec a "Implemented".
    - Registra el hito en la memoria del proyecto.

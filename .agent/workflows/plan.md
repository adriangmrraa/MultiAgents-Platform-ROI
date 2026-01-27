---
description: Transforma un .spec.md en un plan técnico detallado paso a paso para la implementación.
---

# 📅 Antigravity Plan

Convierte la teoría (.spec.md) en una hoja de ruta ejecutable.

1.  **Input**: Pide la ruta del archivo `.spec.md`.
2.  **Activación de `@writing-plans`**:
    - Lee la spec.
    - Genera un archivo `docs/plans/[fecha]-[feature].md`.
    - **Reglas de Planificación**:
      - TDD First: "Tarea 1: Escribir test que falla".
      - Pasos de 2-5 minutos.
      - Comandos exactos de verificación.
3.  **Cross-Check**: Verifica que el plan cubra todos los Criterios de Aceptación de la spec.
4.  **Confirmación**: Muestra el plan al usuario para su aprobación final.

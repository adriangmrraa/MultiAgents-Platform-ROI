---
description: Genera una especificación técnica (.spec.md) rigurosa a partir de requerimientos vagos, usando análisis de 3 pilares.
---

# 📝 Antigravity Specify

Transforma "quiero una feature de login" en un documento de ingeniería blindado.

1.  **Contexto**: Lee `.antigravity_rules` para asegurar conformidad global.
2.  **Entrevista Técnica**:
    - Pregunta por Entradas/Salidas.
    - Pregunta por Restricciones (Performance, Seguridad).
3.  **AppBuilder Skill**:
    - Invoca `@AppBuilder` para sugerir mejoras basadas en competidores o ciencia.
4.  **Generación de `.spec.md`**:
    - Crea un archivo en `docs/specs/[feature].spec.md`.
    - **Estructura Obligatoria**:
      1.  Objetivos de Negocio.
      2.  Esquemas de Datos (JSON Schema/TS Interfaces).
      3.  Lógica de Negocio (Gherkin: Dado/Cuando/Entonces).
      4.  Stack Tecnológico.
      5.  Criterios de Aceptación.

5.  **Revisión**: Pide al usuario que confirme la spec antes de pasar a `/plan`.

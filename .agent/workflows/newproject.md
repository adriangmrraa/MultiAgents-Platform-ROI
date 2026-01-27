---
description: Scaffolding automático para nuevos proyectos Antigravity. Vincula Workflows/Skills globales y se contextualiza con la Memoria del Proyecto.
---

# 🏗️ Antigravity New Project Setup

1.  **Preguntar Nombre**: Solicita el nombre del proyecto.
2.  **Crear Directorio**: `mkdir [NombreProyecto]`.
3.  **Vinculación Híbrida (Local + Global)**:
    - // turbo
      `mkdir .agent\workflows, .agent\skills -Force`
    - // turbo
      `New-Item -ItemType Junction -Path ".agent\workflows\global" -Value "C:\Users\victo\OneDrive\Documentos\Proyectos Google Antigravity\.agent\workflows" -Force`
    - // turbo
      `New-Item -ItemType Junction -Path ".agent\skills\global" -Value "C:\Users\victo\OneDrive\Documentos\Proyectos Google Antigravity\.agent\skills" -Force`
4.  **Constitución Global (Vínculo Directo)**:
    - // turbo
      `New-Item -ItemType HardLink -Path ".antigravity_rules" -Value "C:\Users\victo\OneDrive\Documentos\Proyectos Google Antigravity\.antigravity_rules" -Force`
5.  **Contextualización Inmediata (NUEVO)**:
    - **Acción del Agente**: Debes leer e interpretar obligatoriamente los archivos:
      1. `C:\Users\victo\OneDrive\Documentos\Proyectos Google Antigravity\.antigravity_rules`
      2. `C:\Users\victo\OneDrive\Documentos\Proyectos Google Antigravity\.project_memory.json`
    - El agente debe confirmar que entiende el contexto global y el rol de este nuevo proyecto dentro del ecosistema.
6.  **Estructura de Carpetas (Original)**:
    - `src/`: Código fuente.
    - `docs/specs/`: Especificaciones `.spec.md`.
    - `docs/plans/`: Planes de implementación.
7.  **Inicialización (Original)**:
    - `git init`
    - `npm init -y` (o equivalente según el lenguaje).
8.  **Siguiente Paso (Original)**:
    - Invoca automáticamente `/advisor` para empezar a discutir la idea del proyecto.

// turbo-all 9. **Confirmación**: Muestra un resumen del entorno global vinculado y el estado de la memoria cargada.

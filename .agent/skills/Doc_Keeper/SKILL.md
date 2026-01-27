---
name: "Documentation & Skill Keeper"
description: "Analiza el código y actualiza la documentación (docs/) y las Skills (.agent/skills/) para mantener la coherencia."
trigger: "Cuando el usuario diga 'actualiza la documentación', 'refactoriza esta skill', o después de cambios grandes en arquitectura."
scope: "MAINTENANCE"
auto-invoke: false
---

# Protocolo de Mantenimiento de Documentación

Tu objetivo es garantizar que la documentación sea la "Fuente de la Verdad" y coincida con el Código ("La Realidad").

## 1. Análisis de Diferencias (Diffing)
Antes de editar un documento, compara la realidad con el texto:
1.  **Si actualizas una API:** Lee `app/api/v1/endpoints/`. Compara con `docs/API_REFERENCE.md`. Si hay nuevos parámetros, agrégalos.
2.  **Si actualizas Modelos:** Lee `app/models/`. Compara con `docs/DATABASE_EVOLUTION.md`.
3.  **Si actualizas una Skill:** Verifica si las herramientas o librerías mencionadas en el `SKILL.md` siguen existiendo en el proyecto.

## 2. Reglas de Actualización de Skills
Si se te pide "Refactorizar una Skill":
1.  Lee el archivo `.agent/skills/{Nombre}/SKILL.md`.
2.  Verifica si los comandos o snippets de código en la sección de "Protocolos" siguen siendo válidos en la versión actual del código.
3.  **Ejemplo:** Si el código migró de `pydantic.BaseModel` a `pydantic.v1.BaseModel`, actualiza el snippet en la Skill.
4.  Mantén intacto el bloque YAML (Frontmatter) a menos que cambie el `trigger`.

## 3. Reglas de Actualización de Docs (Carpeta /docs o raíz)
1.  **No borres historia:** Si algo es obsoleto pero relevante históricamente, márcalo como `> [!WARNING] DEPRECATED`, no lo borres.
2.  **Actualización de Rutas:** Si los archivos cambiaron de lugar, actualiza los paths en `AGENTS.md` y `README.md`.
3.  **Formato:** Respeta estrictamente el formato Markdown existente (headers, tablas, bloques de código).

## 4. Ejecución
1.  Lee el archivo objetivo.
2.  Genera el nuevo contenido con las correcciones.
3.  Sobreescribe el archivo.
4.  Si es una Skill, sugiere ejecutar la skill **"Skill Synchronizer"** al finalizar para actualizar el índice global.

## 5. Criterio de Verdad
- El **CÓDIGO** (`.py`, `.tsx`) siempre tiene la razón sobre el texto (`.md`).
- Si el documento dice "Puerto 3000" y el Dockerfile dice "8000", corrige el documento a "8000".

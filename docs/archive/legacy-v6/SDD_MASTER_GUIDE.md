# Guía Maestra de Implementación: Spec-Driven Development (SDD v2.0)

Este documento define el marco de trabajo oficial para la ingeniería de software asistida por IA en Platform AI Solutions.

## 1.0 Fundamentos Estratégicos

**Spec-Driven Development (SDD)** transforma la intención humana en código predecible.
- **SSOT**: La especificación (`.spec.md`) es la Única Fuente de Verdad.
- **Constitución**: `.antigravity_rules` define las reglas inmutables del proyecto.
- **Flujo**: `specify` -> `plan` -> `tasks` -> `implement` -> `verify`.

### Comparativa: Vibe Coding vs. SDD

| Vibe Coding (Ad-Hoc) | Spec-Driven Development (Estructurado) |
| -------------------- | ------------------------------------- |
| Impredecible | Determinista |
| Falta de Contexto | Ámbito Explícito y Auditable |
| Soluciones Incorrectas | Alineación de Stakeholders |

## 2.0 La Constitución del Agente

Las reglas globales se encuentran en `.antigravity_rules` en la raíz del proyecto. Estas reglas son inyectadas en cada tarea de implementación para asegurar la adherencia a los estándares de arquitectura, código, tecnología y seguridad.

## 3.0 Arquitectura Ejecutable (.spec.md)

Cada feature o cambio significativo debe comenzar con un archivo `.spec.md` que siga la plantilla estricta definida en `templates/spec_template.md`.

### Estructura del Spec
1. **Contexto**: ¿Qué y Por qué?
2. **Esquemas de Datos**: JSON/TypeScript interfaces.
3. **Lógica de Negocio**: Reglas invariantes (SI... ENTONCES...).
4. **Stack Tecnológico**: Librerías y restricciones (anula reglas globales si es necesario).
5. **Criterios de Aceptación**: Gherkin (Dado-Cuando-Entonces).

## 4.0 Flujo de Trabajo Autónomo

1. **/specify**: Generar borrador de `.spec.md`.
2. **/refine**: (Nuevo) El agente cuestiona el spec para eliminar ambigüedades.
3. **/plan**: Crear plan técnico detallado (`implementation_plan.md`).
4. **/tasks**: Desglosar en tareas atómicas (`task.md`).
5. **/gate**: (Nuevo) Evaluar confianza antes de implementar.
6. **/implement**: Escribir código.
7. **/verify**: Auto-corrección y tests.
8. **/audit**: (Nuevo) Verificar drift entre código y spec.

## 5.0 Principios de Ingeniería Avanzada

- **Self-Correction Loops**: El agente reintenta si `/verify` falla.
- **Context Injection**: Solo inyectar lo necesario para la tarea actual.
- **Validation Gates**: Tests automáticos post-implementación.

## 6.0 Hoja de Ruta Evolutiva (Sprints)

1. **Fase 1**: Estructura Básica (Specify -> Plan -> Tasks -> Implement).
2. **Fase 2**: Autonomía (Refine, Gate, Audit).
3. **Fase 3**: Mantenimiento Proactivo (Refactorización continua).

---
description: Ciclo de Auto-verificación y Corrección. Ejecuta tests y arregla fallos sin intervención humana.
---

# 🤖 Antigravity Verify

El escudo final antes de dar una tarea por completada.

1.  **Ejecución de Tests**: Corre `npm test`, `pytest` o el comando definido en el `/plan`.
2.  **Bucle de Autocorrección (Self-Correction Loop)**:
    - Si hay fallo: Lee el stack trace, analiza el error.
    - Propone corrección -> Aplica corrección.
    - Re-ejecuta tests. (Límite: 3 reintentos).
3.  **Cross-Verification**: Prueba manualmente (vía terminal o scripts) que el resultado visual o de datos sea el esperado por la Spec.
4.  **Habilitación de Skill**: Si el fallo es persistente, invoca a `@systematic-debugging` para un análisis profundo.

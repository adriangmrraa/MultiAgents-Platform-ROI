
# [Nombre del Feature]

## 1. Contexto del Sistema y Objetivos de Negocio
<!-- 
Describe el "qué" y el "porqué" de la funcionalidad. 
¿Qué problema resuelve? ¿Cómo se medirá el éxito?
-->

## 2. Esquemas de Datos (Entrada/Salida)
<!-- 
Define la estructura de datos, payloads de API y modelos de dominio.
Usa JSON Schema o interfaces TypeScript explícitas.
-->

```typescript
interface ExamplePayload {
  field: string;
}
```

## 3. Lógica de Negocio e Invariantes
<!-- 
Detalla las reglas, cálculos y condiciones.
Formato: SI <condición> ENTONCES <resultado>.
-->

- SI el usuario es admin, ENTONCES puede ver todos los registros.
- INVARIANTE: El saldo nunca puede ser negativo.

## 4. Stack Tecnológico y Restricciones
<!-- 
Especifica tecnologías, librerías, versiones.
Anula o complementa las reglas globales de .antigravity_rules aquí.
-->

- Frontend: React 18, Tailwind
- Backend: FastAPI
- DB: PostgreSQL

## 5. Criterios de Aceptación Técnicos
<!-- 
Escenarios de prueba verificables (Gherkin recomendado).
-->

### Escenario 1: [Nombre]
- **Dado** que [precondición/estado]
- **Cuando** [acción del usuario/sistema]
- **Entonces** [resultado esperado]

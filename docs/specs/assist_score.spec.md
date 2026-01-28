# .spec: Protocolo de Asistencia Soberana (Assist Score v1.0) 🧠

## 1. Objetivos de Negocio
Medir de forma cuantitativa y cualitativa el valor transaccional (ventas) y operativo (soporte) que los agentes de Nexus aportan a cada tienda. Esto permitirá calcular el ROI real del sistema.

## 2. Esquemas de Datos

### 2.1. PostgreSQL (Table: `chat_conversations`)
| Columna | Tipo | Descripción |
| :--- | :--- | :--- |
| `assist_sales_score` | FLOAT | Acumulado de puntos de asistencia en ventas (0.0 a 1.0). |
| `assist_support_score` | FLOAT | Acumulado de puntos de resolución de soporte autónomo. |
| `assist_checkpoints` | INTEGER | Cantidad de veces que se ha evaluado la asistencia en este chat. |
| `last_assist_analysis` | JSONB | Razonamiento de la IA (`reasoning`) y timestamp. |

### 2.2. Tool Definition: `report_assistance`
- **Argumentos**:
  - `type` (string): 'sales' o 'support'.
  - `score` (float): Valor del 0.0 al 1.0.
  - `reasoning` (string): Breve explicación de por qué se asignó ese puntaje.

## 3. Lógica de Negocio (Gherkin)

**Escenario: Auto-Auditoría de Ventas**
- **Dado** que el usuario ha preguntado por precios, stock o métodos de pago.
- **Cuando** el agente ha respondido satisfactoriamente facilitando la decisión de compra.
- **Y** es el 3er turno de mensaje del usuario.
- **Entonces** el agente debe llamar a `report_assistance(type='sales', score=1.0, reasoning='...')`.

**Escenario: Auto-Auditoría de Soporte**
- **Dado** que el usuario tiene una duda técnica o de envío.
- **Cuando** el agente resuelve la duda sin intervención humana.
- **Y** es el 3er turno de mensaje del usuario.
- **Entonces** el agente debe llamar a `report_assistance(type='support', score=1.0, reasoning='...')`.

## 4. Stack Tecnológico
- **Backend**: FastAPI (Orchestrator) + SQLAlchemy (PostgreSQL).
- **IA**: LLM inyectado con herramienta `report_assistance` y reglas de sistema.
- **Frontend**: React 18 + Tailwind CSS + Lucide Icons para el Dashboard.

## 5. Criterios de Aceptación
1. [ ] La migración #39 se ejecuta correctamente añadiendo las 4 columnas.
2. [ ] El agente llama a la herramienta automáticamente cada 3 turnos del usuario.
3. [ ] Los valores en `chat_conversations` se incrementan correctamente (atómico).
4. [ ] El Dashboard muestra una tarjeta de "Impacto Directo" con el cálculo de ROI.
5. [ ] La herramienta no es mencionada al usuario final (ejecución silenciosa).

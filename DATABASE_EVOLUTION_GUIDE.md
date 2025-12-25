# Guía de Evolución de Base de Datos: "La Casa y los Planos"

**Este documento explica qué pasó con el error "Schema Drift" (Desviación de Esquema) y cómo evitarlo al agregar nuevas funciones en el futuro.**

---

## 1. ¿Qué pasó? (Explicación para No-Técnicos)

Imagina que tu aplicación es un **Edificio de Departamentos**.
*   La **Base de Datos** es la estructura física del edificio.
*   El **Código (Python/Backend)** son los planos que usan los arquitectos para trabajar.

### El Problema
Recientemente, decidimos agregar una nueva función: **"Interruptor General de Luz"** (la columna `is_active`) para poder apagar departamentos (tiendas) individualmente.

Actualizamos los **planos** (el código) diciendo: *"Ahora todos los departamentos deben tener un interruptor maestro"* y *"No se permite que el interruptor no exista"*.

**El error ocurrió porque:**
Fuimos al edificio existente (la base de datos real en EasyPanel) y el código intentó buscar este interruptor en los departamentos viejos. Como **no lo construimos físicamente** en los datos existentes, el sistema entró en pánico ("¡Error! ¡Se requiere interruptor y aquí hay un hueco vacío!").

Esto se llama **Crash por Violación de Restricción (NotNullViolation)**.

---

## 2. ¿Cómo lo solucionamos? (La Reparación Automática)

Para no tener que demoler el edificio y construirlo de nuevo cada vez que cambiamos algo, implementamos un **"Robot de Mantenimiento"** (Scripts de Migración en el arranque).

Cada vez que el sistema se enciende, este robot hace lo siguiente:
1.  Revisa los planos actuales.
2.  Camina por el edificio.
3.  Si ve que falta el "Interruptor General", **lo instala automáticamente**.
4.  **¡Muy Importante!** Si el interruptor es nuevo, **lo deja encendido por defecto** (DEFAULT TRUE) para que nadie se quede a oscuras de repente.

---

## 3. Guía para el Futuro: "Quiero agregar algo nuevo"

Digamos que mañana quieres agregar una función para saber si la tienda es "VIP" o "Estándar".
Necesitas agregar un campo `plan_type`. Sigue estos 4 Pasos Sagrados:

### Paso 1: Definir en los Planos (Python Models)
En los archivos de modelos (`models/tenant.py` o similares), agregas la variable.
*   *Incorrecto:* `plan_type: str` (¡Peligroso! Si no hay dato, crashea).
*   *Correcto:* `plan_type: str = "standard"` (Tiene un valor por defecto).

### Paso 2: Definir en la Creación (SQL Init)
En el archivo que crea la base de datos de cero (`db/init/*.sql` o `main.py` -> `CREATE TABLE`), agregas la columna.
```sql
plan_type VARCHAR(50) DEFAULT 'standard'
```

### Paso 3: El Robot de Mantenimiento (La Clave del Éxito)
Este es el paso que faltó y causó los errores recientes. Debes ir a `orchestrator_service/main.py` (sección `migration_steps`) y decirle al robot qué hacer si encuentra una base vieja.

Debes agregar un bloque así:
```sql
DO $$ 
BEGIN 
    -- "Si no existe la columna plan_type, agrégala y ponle 'standard' a todos"
    ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50) DEFAULT 'standard';
EXCEPTION WHEN OTHERS THEN 
    -- "Si falla, no explotes, solo avísame"
    RAISE NOTICE 'Error menor al actualizar'; 
END $$;
```

### Paso 4: La Regla de Oro de los Defaults
**SIEMPRE** que agregues algo a un sistema que ya está vivo (tiene usuarios/datos), debes preguntarte:
> *"¿Qué valor deben tener los datos antiguos que ya existen?"*

*   Si es texto: Usa `DEFAULT ''` (vacío) o `DEFAULT 'valor_comun'`.
*   Si es número: Usa `DEFAULT 0`.
*   Si es booleano (Si/No): Usa `DEFAULT FALSE` o `DEFAULT TRUE`.
*   **NUNCA** dejes que sea `NULL` (vacío/nulo) si el código no está preparado para manejar la "nada absoluta".

---

## Resumen de Salud del Proyecto
*   **Calificación del Problema:** Intermedio (Estructural).
*   **Estado Actual:** Corregido con auto-reparación.
*   **Robustez:** Ahora el sistema es "Auto-Curable" para las columnas `is_active`, `store_location` y las de Branding.

# Guía de Mejores Prácticas: Configuración de Agentes Nexus

Para que un agente pase de ser un "bot genérico" a un **Vendedor Maestro (v7+)**, la clave no es darle más texto, sino **señales más claras**. Esta guía resume las mejores prácticas para los 8 bloques de configuración.

---

## 💡 Filosofía Core: Señal vs. Ruido
El mayor enemigo de la IA es la **saturación de contexto**. 
- **Mala Práctica:** Repetir información en varios bloques (ej. poner los envíos en la Identidad y en las Reglas).
- **Buena Práctica:** Cada bloque tiene una misión única. Si la información no es accionable para el agente, mejor omitirla.

---

## 1. Pitch de Identidad (El ADN)
- **Sé un Espejo:** Describe el negocio desde la propuesta de valor, no solo del catálogo.
- **Diferenciador:** Incluye qué "NO" son. (Ej: "No somos una ferretería masiva, somos consultores técnicos").
- **Tip:** Evita adjetivos vacíos ("el mejor", "increíble"). Usa hechos.

## 2. Definición del Tono (La Voz)
- **Voseo vs. Tú:** Sé consistente. En Argentina, el voseo genera cercanía; en otros mercados, el "Tú" es estándar.
- **Límites de Puntuación:** Es vital prohibir el exceso de signos de exclamación (!!!) para no parecer un bot de spam.
- **Personalidad:** Dale una profesión (Ej: "Hablá como un curador de arte", "Hablá como un mecánico que te cuida el bolsillo").

## 3. Reglas de Negocio (Logística y Operación)
- **Números Estrictos:** Usa formatos claros: "$3500", "24hs", "13:00hs". La IA procesa mejor los datos concretos que los términos vagos como "rápido" o "barato".
- **Comandos Imperativos:** Usa "PROHIBIDO", "ES OBLIGATORIO", "SIEMPRE".

## 4. Conflictos (Cambios y Devoluciones)
- **Estado de Cero Fricción:** Dale al agente la respuesta a la objeción antes de que ocurra.
- **Excepciones:** Define claramente qué productos NO tienen cambio (ej. Sale, Ropa Interior).

## 5. Pagos y Financiación
- **Cierre de Venta:** El descuento por transferencia es la herramienta de cierre más potente. Asegurate de que el agente lo mencione *antes* de que el usuario lo pida.
- **Claridad Bancaria:** Especifica si las cuotas son con tarjetas bancarias o de grandes tiendas (la tasa cambia).

## 6. Diccionario de Sinónimos (Semántica)
- **Mapeo de Jerga:** Si tu cliente dice "remerilla" y tu sistema dice "Básico Algodón", la IA necesita el puente aquí.
- **Categorías Maestras:** Agrupa términos similares bajo un nombre de categoría que coincida con tu Tienda Nube.

## 7. Estructura del Catálogo (El GPS)
- **Calcar la Tienda:** El agente debe saber la jerarquía (Categoría > Subcategoría). Si esto falla, el agente dirá "no tenemos" algo que sí está en stock.
- **Tip:** No listes 100 productos, lista las **rutas de navegación**.

## 8. Cierre y Validación (Regla Maestra)
- **Honestidad Radical:** Instruye al agente a admitir si no sabe algo o si no hay stock. Esto genera más ventas a largo plazo que una promesa falsa.
- **Call to Action (CTA):** Define cómo debe terminar el agente (Ej: "Siempre ofrece el link de pago al final de una cotización").

---

## 🛠️ Tip de Oro: Tactical vs. Strategic
- **Strategic (Wizard):** Qué quiero que sea el agente.
- **Tactical (main.py):** Cómo quiero que use las tools de Tienda Nube.
> *Si el agente es maleducado, corregí el **Wizard**. Si el agente no encuentra productos, corregí la **Táctica de Tool**.*

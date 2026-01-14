# REQUERIMIENTOS NO FUNCIONALES (RNF)

**Proyecto:** Fábrica de Negocios Autónoma
**Propósito:** Definir los criterios de calidad y restricciones necesarios para soportar la visión de una "Fuerza Laboral Digital" escalable y confiable.

---

## 1. Desempeño y Latencia (Performance)
*   **RNF-001 Latencia de Conversación:** El sistema debe generar el primer token de respuesta ("Time to First Token") en menos de **2 segundos** para mantener la fluidez de una conversación humana.
*   **RNF-002 Capacidad de Respuesta en Picos:** El sistema debe soportar picos de tráfico (ej. Black Friday) sin degradar el tiempo de respuesta por encima de los 4 segundos.
*   **RNF-003 Procesamiento de Ingesta:** La sincronización inicial ("Onboarding") de una tienda promedio (500 productos) debe completarse en menos de **60 segundos** para cumplir la promesa de "Magic Onboarding".

## 2. Escalabilidad y Volumetría
*   **RNF-004 Escalabilidad Horizontal:** La arquitectura debe permitir agregar más capacidad de procesamiento simplemente añadiendo más unidades de cómputo, sin modificar el código base.
*   **RNF-005 Aislamiento de Carga (Multi-Tenant):** La actividad intensiva de un cliente (ej. un lanzamiento viral) **NO** debe afectar el rendimiento de los otros clientes alojados en la plataforma.
*   **RNF-006 Crecimiento de Datos:** El sistema debe ser capaz de gestionar un crecimiento exponencial en el historial de conversaciones y vectores sin degradar la velocidad de búsqueda de productos.

## 3. Disponibilidad y Confiabilidad
*   **RNF-007 Disponibilidad (Uptime):** El sistema debe garantizar un **99.9%** de tiempo de actividad durante horario comercial, dado que opera ventas en tiempo real.
*   **RNF-008 Recuperación ante Fallos:** En caso de caída de un componente (ej. servicio de IA externo), el sistema debe degradarse elegantemente (ej. pausar respuestas automáticas y alertar humano) en lugar de colapsar o dejar mensajes sin respuesta.
*   **RNF-009 Persistencia Garantizada:** Ningún mensaje de usuario confirmado como "recibido" (ACK) puede perderse, incluso ante un reinicio abrupto del sistema.

## 4. Seguridad y Privacidad
*   **RNF-010 Protección de Credenciales:** Las llaves de acceso a las tiendas (Tokens, API Keys) deben almacenarse encriptadas en reposo y nunca ser visibles en texto plano, ni siquiera para los administradores del sistema.
*   **RNF-011 Aislamiento de Datos (Data Governance):** Los datos de una tienda (productos, estrategias, clientes) deben estar estricta y lógicamente separados; es inaceptable que el Agente de la Tienda A tenga acceso o "alucine" con datos de la Tienda B.

## 5. Mantenibilidad y Evolución
*   **RNF-012 Desacoplamiento de IA:** El sistema debe estar diseñado para permitir el cambio de modelos de IA subyacentes (ej. cambiar de GPT-4 a Claude 3 o Llama 3) sin necesidad de reescribir la lógica de negocio.
*   **RNF-013 Observabilidad (Caja Transparente):** El sistema debe proveer trazas detalladas del proceso de decisión ("Thinking Logs") para permitir a los desarrolladores entender por qué un agente tomó una decisión específica.

## 6. Usabilidad y Experiencia (UX)
*   **RNF-014 Feedback Inmediato:** Ante procesos largos (como la generación de imágenes), el sistema debe informar el estado continuamente para evitar la percepción de "sistema colgado".
*   **RNF-015 Claridad en Errores:** Los mensajes de error hacia el usuario final nunca deben exponer detalles técnicos (`stack traces`), sino ofrecer salidas conversacionales amigables.

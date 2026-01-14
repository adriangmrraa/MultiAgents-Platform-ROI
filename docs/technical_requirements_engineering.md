# Documento de Ingeniería de Requerimientos - Plataforma E-commerce AI

**Documento Técnico (Enfoque Desarrollo)**
**Destinatarios:** Equipo de Desarrollo, Scrum Master, Product Owner.
**Referencia:** Base para la creación del Backlog en Jira.

---

## 1. Contexto Técnico
El objetivo es reconstruir la plataforma desde cero bajo una arquitectura de microservicios escalable, orientada a eventos y "Stateless", que soporte la orquestación de múltiples agentes de IA.

## 2. Requerimientos Funcionales (RF)

### RF-01: Ingesta y Sincronización de Datos (The Knowledge Layer)
*   **Descripción:** El sistema debe conectarse a las APIs de plataformas de e-commerce (ej. Tienda Nube, Shopify) para extraer catálogo, stock y órdenes.
*   **Detalle:** Debe soportar actualizaciones en tiempo real (Webhooks) o polling eficiente.
*   **Regla:** La data debe normalizarse en una estructura común para alimentar a los agentes.

### RF-02: Sistema de Agentes Autónomos (The Brain)
*   **Descripción:** Arquitectura para desplegar "Specialist Agents" (Ventas, Soporte, Creativo).
*   **Detalle:** Cada agente debe tener un "System Prompt" dinámico inyectado con el contexto de la tienda (obtenido en RF-01).
*   **Regla:** Los agentes no deben compartir memoria entre tenants (Aislamiento).

### RF-03: Generación de Activos Multimodales
*   **Descripción:** Capacidad de generar imágenes (Banners) y Texto (Copys) publicitarios.
*   **Detalle:** Integración con modelos de difusión (DALL-E 3, Imagen) y LLMs, utilizando las imágenes de producto como "Input" (Image-to-Image o referencia).

### RF-04: Orquestación Omnicanal
*   **Descripción:** Centralizar la mensajería de WhatsApp, Instagram y Web.
*   **Detalle:** Unificar hilos de conversación y mantener el contexto del usuario a través de canales.

### RF-05: Human Handoff (Safety Layer)
*   **Descripción:** Mecanismo para detener a la IA y alertar a un humano.
*   **Detalle:** Detección de sentimientos negativos o palabras clave ("Hablar con humano").

## 3. Requerimientos No Funcionales (RNF) - Épica Prioritaria

Los RNF definen la calidad del sistema y son críticos para la arquitectura inicial.

*   **RNF-01 Latencia (Performance):** El "Time to First Token" (TTFT) en respuestas de chat debe ser < 2 segundos.
*   **RNF-02 Escalabilidad (Architecture):** La arquitectura debe ser Horizontalmente Escalable (Kubernetes/Docker). Ningún servicio crítico debe guardar estado en memoria local.
*   **RNF-03 Seguridad (Security):** Encriptación en reposo para credenciales de terceros (API Keys). Cumplimiento básico de GDPR/Protección de datos.
*   **RNF-04 Observabilidad (DevOps):** Trazabilidad completa de las decisiones de la IA (Logs de "Pensamiento") visible para debugging.

## 4. Stack Tecnológico Sugerido (Tentativo)
*   **Backend:** Python (FastAPI/Django) - Por su ecosistema de IA.
*   **Frontend:** React/Next.js - Para el dashboard administrativo.
*   **Base de Datos:** PostgreSQL (Relacional) + Redis (Cache/PubSub) + Vector DB (Qdrant/Chroma).
*   **Infraestructura:** Docker containers, orquestación preliminar en servicios tipo PaaS o K8s.

## 5. Timeline Referencial (Fases)
*   **Fase 1 (Sprints 1-3):** Core de Ingesta, Base de Datos y Chatbot Básico (Texto).
*   **Fase 2 (Sprints 4-6):** Módulo de Agentes Especializados y Generación de Contenido (Multimodal).
*   **Fase 3 (Sprints 7-8):** Orquestación Omnicanal y Dashboard Administrativo (Business Forge).

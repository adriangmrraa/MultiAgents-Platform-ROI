---

# 🛸 Nexus v5.4: Sovereign SaaS Architecture

> **Plataforma Multi-Agente de Alto ROI para E-Commerce (TiendaNube + WhatsApp + Meta)**
> *Arquitectura Soberana, Multi-Tenant y Zero-Dependency.*

---

## 🔥 Pilares de la Evolución v5.4

### 🗄️ 1. Motor RAG: Supabase (pgvector)
Hemos migrado de ChromaDB/SQLite a una infraestructura vectorial de grado empresarial.
*   **Tecnología:** Supabase (pgvector) self-hosted vía EasyPanel.
*   **Escalabilidad:** Aislamiento total por `tenant_id` en el espacio vectorial.
*   **Resiliencia:** Inicialización automática de tablas y extensiones mediante el bootstrapper interno.

### 🔌 2. Zero-Dependency Startup
El sistema es ahora "SaaS Ready" desde el primer segundo.
*   **Independencia:** El backend arranca con éxito sin necesidad de `OPENAI_API_KEY` o `GOOGLE_API_KEY` en el entorno global.
*   **Lazy Resolution:** Las credenciales se inyectan bajo demanda (Inquilino > Global Fallback).
*   **Robustez:** Errores controlados (400) si un agente intenta operar sin llaves configuradas.

### 🤖 3. Model Registry & SOTA 2026
Integración completa del panorama de IA de Enero 2026.
*   **Niveles de Inteligencia:** Selección dinámica entre **Economy** (GPT-5 Mini), **Advanced** (GPT-5.2) y **Premium** (o3-high).
*   **Multi-Provider:** Soporte nativo y optimizado para el stack de **OpenAI** y **Google (Gemini 3)**.
*   **Intelligent Fallback:** Degradación automática a modelos Advanced si los Premium están saturados.

### 🛡️ 4. Bóveda de Credenciales Soberana
AES-256 para proteger el negocio de tus clientes.
*   Cada inquilino gestiona sus propias cuotas y límites directamente desde el Panel de Configuración.

### 🧠 5. Multi-Agent Orchestration (v5.30)
Evolución de monocanal a **Polimorfismo Especializado**.
*   **Roles Dinámicos**: Plantillas nativas para **Ventas**, **Soporte**, **Leads** y **Logística**.
*   **Dynamic Wizard**: Configuración en lenguaje natural con Live Preview (Simulación en Tiempo Real).
*   **Auto-Onboarding**: Creación automática del Agente de Ventas al conectar la tienda.

---

## 🚀 Despliegue en EasyPanel

### Requisitos Mínimos
*   EasyPanel Project con **PostgreSQL (Supabase)**, **Redis** y **MinIO/S3**.

### Quick Start
1.  Configura las variables críticas en tu servicio (Ver `.env.example`).
2.  Despliega la imagen Docker.
3.  El sistema detectará y configurará la base de datos vectorial automáticamente.

---

## 📚 Documentación Oficial

*   **[Guía de Despliegue](./docs/DEPLOYMENT.md)**: Pasos detallados para entorno de producción.
*   **[Referencia de API](./docs/API_REFERENCE.md)**: Endpoints de sistema y gestión de modelos.
*   **[Manual de Vuelo v5.4](./Manual%20de%20Vuelo%20Nexus%20v5.md)**: Guía operativa para administradores.
*   **[Arquitectura de Agentes](./docs/AGENT_ARCHITECTURE.md)**: Deep Dive en el motor polimórfico y seguridad.
*   **[Wizard & Onboarding](./docs/WIZARD_WIRING.md)**: Flujos de configuración dinámica y "Live Preview".

---

**© 2026 Platform AI Solutions - Nexus Core Team**
